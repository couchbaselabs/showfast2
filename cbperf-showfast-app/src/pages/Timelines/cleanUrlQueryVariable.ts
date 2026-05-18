/**
 * QueryVariable subclass that syncs state to clean URL params (e.g. ?component=kv)
 * instead of Grafana Scenes' default var- prefix (e.g. ?var-component=kv).
 */

import { QueryVariable } from '@grafana/scenes';

type SceneObjectUrlValue = string | string[] | undefined | null;
type SceneObjectUrlValues = Record<string, SceneObjectUrlValue>;

class CleanUrlVariableSyncHandler {
  private _nextChangeShouldAddHistoryStep = false;

  constructor(private _variable: QueryVariable) {}

  // Use unknown as intermediary to safely access state fields not in the public type.
  private get _state(): Record<string, unknown> {
    return this._variable.state as unknown as Record<string, unknown>;
  }

  getKeys(): string[] {
    if (this._state['skipUrlSync']) {
      return [];
    }
    return [this._variable.state.name];
  }

  getUrlState(): SceneObjectUrlValues {
    if (this._state['skipUrlSync']) {
      return {};
    }

    const value = this._variable.state.value;
    let urlValue: string | string[];

    if (Array.isArray(value) && value.length > 1) {
      urlValue = value.map(String);
    } else if (this._state['isMulti']) {
      urlValue = [String(value)];
    } else {
      urlValue = String(value);
    }

    return { [this._variable.state.name]: urlValue };
  }

  updateFromUrl(values: SceneObjectUrlValues): void {
    const name = this._variable.state.name;
    // Accept both the clean key and the legacy var- key.
    let urlValue = values[name] ?? values[`var-${name}`];

    if (urlValue == null) {
      return;
    }

    // Translate legacy "All" text value to internal all-variable sentinel.
    if (this._state['includeAll'] && Array.isArray(urlValue) && urlValue[0] === 'All') {
      urlValue = ['$__all'];
    }

    // Translate custom allValue to the internal sentinel.
    if (typeof this._state['allValue'] === 'string' && this._state['allValue'] === urlValue) {
      urlValue = '$__all';
    }

    if (!this._variable.isActive) {
      (this._variable as unknown as Record<string, unknown>)['skipNextValidation'] = true;
    }

    this._variable.changeValueTo(urlValue as string | string[]);
  }

  shouldCreateHistoryStep(_values: SceneObjectUrlValues): boolean {
    return this._nextChangeShouldAddHistoryStep;
  }

  performBrowserHistoryAction(callback: () => void): void {
    this._nextChangeShouldAddHistoryStep = true;
    callback();
    this._nextChangeShouldAddHistoryStep = false;
  }
}

/**
 * A QueryVariable that uses the variable name directly as the URL key,
 * without the default `var-` prefix imposed by Grafana Scenes.
 */
export class CleanUrlQueryVariable extends QueryVariable {
  constructor(initialState: ConstructorParameters<typeof QueryVariable>[0]) {
    super(initialState);
    // Replace the default MultiValueUrlSyncHandler with our clean-URL version.
    (this as unknown as Record<string, unknown>)['_urlSync'] = new CleanUrlVariableSyncHandler(this);
  }
}
