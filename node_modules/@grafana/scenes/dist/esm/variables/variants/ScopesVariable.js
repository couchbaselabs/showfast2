import { SceneObjectBase } from '../../core/SceneObjectBase.js';
import { SceneVariableValueChangedEvent } from '../types.js';
import { ScopesContext } from '@grafana/runtime';
import { useContext, useEffect } from 'react';
import { VariableHide, VariableFormatID } from '@grafana/schema';
import { SCOPES_VARIABLE_NAME } from '../constants.js';
import { isEqual } from 'lodash';
import { getQueryController } from '../../core/sceneGraph/getQueryController.js';
import { SCOPES_CHANGED_INTERACTION } from '../../performance/interactionConstants.js';

class ScopesVariable extends SceneObjectBase {
  constructor(state) {
    super({
      skipUrlSync: true,
      loading: true,
      scopes: [],
      ...state,
      type: "system",
      name: SCOPES_VARIABLE_NAME,
      hide: VariableHide.hideVariable
    });
    this._renderBeforeActivation = true;
    // Special options that enables variables to be hidden but still render to access react contexts
    this.UNSAFE_renderAsHidden = true;
  }
  /**
   * Temporary simple implementation to stringify the scopes.
   */
  getValue() {
    var _a;
    const scopes = (_a = this.state.scopes) != null ? _a : [];
    return new ScopesVariableFormatter(scopes.map((scope) => scope.metadata.name));
  }
  getScopes() {
    return this.state.scopes;
  }
  /**
   * This method is used to keep the context up to date with the scopes context received from React
   * 1) Subscribes to ScopesContext state changes and synchronizes it with the variable state
   * 2) Handles enable / disabling of scopes based on variable enable option.
   */
  setContext(context) {
    if (!context) {
      return;
    }
    this._context = context;
    const oldState = context.state;
    if (this.state.enable != null) {
      context.setEnabled(this.state.enable);
    }
    const sub = context.stateObservable.subscribe((state) => {
      this.updateStateFromContext(state);
    });
    return () => {
      sub.unsubscribe();
      if (this.state.enable != null) {
        context.setEnabled(oldState.enabled);
      }
    };
  }
  updateStateFromContext(state) {
    const loading = state.value.length === 0 ? false : state.loading;
    const oldScopes = this.state.scopes.map((scope) => scope.metadata.name);
    const newScopes = state.value.map((scope) => scope.metadata.name);
    const scopesHaveChanged = !isEqual(oldScopes, newScopes);
    if (!loading && (scopesHaveChanged || newScopes.length === 0)) {
      const queryController = getQueryController(this);
      queryController == null ? void 0 : queryController.startProfile(SCOPES_CHANGED_INTERACTION);
      this.setState({ scopes: state.value, loading });
      this.publishEvent(new SceneVariableValueChangedEvent(this), true);
    } else {
      this.setState({ loading });
    }
  }
}
ScopesVariable.Component = ScopesVariableRenderer;
function ScopesVariableRenderer({ model }) {
  const context = useContext(ScopesContext);
  useEffect(() => {
    return model.setContext(context);
  }, [context, model]);
  return null;
}
class ScopesVariableFormatter {
  constructor(_value) {
    this._value = _value;
  }
  formatter(formatNameOrFn) {
    if (formatNameOrFn === VariableFormatID.QueryParam) {
      return this._value.map((scope) => `scope=${encodeURIComponent(scope)}`).join("&");
    }
    return this._value.join(", ");
  }
}

export { ScopesVariable, ScopesVariableFormatter };
//# sourceMappingURL=ScopesVariable.js.map
