/**
 * Orchestrates Timelines filter-variable lifecycle and dependency synchronization.
 * Scene composition should stay in timelinesScene.ts.
 */

import { QueryVariable } from '@grafana/scenes';
import { Subject, from, EMPTY } from 'rxjs';
import { auditTime, concatMap, catchError, tap } from 'rxjs/operators';
import { FILTER_DEFINITIONS, VariableName } from './filterConfig';
import {
  buildVariableQuery,
  createFilterVariable,
  getPeerDependencies,
  setQueryIfChanged,
} from './variableHelpers';

export interface TimelineVariableController {
  variables: QueryVariable[];
}

const explicitDefaultByVariable: Partial<Record<VariableName, string>> = {
  component: 'kv',
  category: 'max_ops',
};

function isAllSelected(value: unknown): boolean {
  return value === '$__all' || (Array.isArray(value) && value.length > 0 && value[0] === '$__all');
}

function isEmptySelection(value: unknown): boolean {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0);
}

function runVariableUpdate(variable: QueryVariable): Promise<void> {
  return new Promise((resolve) => {
    variable.validateAndUpdate().subscribe({
      complete: () => resolve(),
      error: () => resolve(),
    });
  });
}

export function createTimelineVariableController(onReady?: () => void): TimelineVariableController {
  const variableMap = FILTER_DEFINITIONS.reduce((acc, definition) => {
    acc[definition.name] = createFilterVariable(definition.name, definition.label, definition.endpoint);
    return acc;
  }, {} as Record<VariableName, QueryVariable>);

  const variables = FILTER_DEFINITIONS.map((definition) => variableMap[definition.name]);

  const applyExplicitDefaults = (): boolean => {
    let changed = false;

    FILTER_DEFINITIONS.forEach((definition) => {
      const defaultValue = explicitDefaultByVariable[definition.name];
      const variable = variableMap[definition.name];
      const currentValue = variable.state.value;

      if (!defaultValue) {
        if (isEmptySelection(currentValue)) {
          variable.changeValueTo('$__all', 'All');
          changed = true;
        }
        return;
      }

      const options = variable.state.options ?? [];
      const matchingOption = options.find((option) => option.value === defaultValue);
      if (!matchingOption) {
        if (isEmptySelection(currentValue)) {
          variable.changeValueTo('$__all', 'All');
          changed = true;
        }
        return;
      }

      const isDefaultSelected =
        Array.isArray(currentValue) && currentValue.length === 1 && currentValue[0] === defaultValue;
      const selectedAll = isAllSelected(currentValue);
      const selectedEmpty = isEmptySelection(currentValue);

      if (isDefaultSelected || (!selectedAll && !selectedEmpty)) {
        return;
      }

      variable.changeValueTo([defaultValue], [matchingOption.label]);
      changed = true;
    });

    return changed;
  };

  const syncQueries = (): QueryVariable[] => {
    const changed: QueryVariable[] = [];
    FILTER_DEFINITIONS.forEach((definition) => {
      const dependencies = getPeerDependencies(definition.name);
      const query = buildVariableQuery(definition.endpoint, dependencies);
      if (setQueryIfChanged(variableMap[definition.name], query)) {
        changed.push(variableMap[definition.name]);
      }
    });
    return changed;
  };

  const runRefreshPipeline = async (): Promise<void> => {
    const changed = syncQueries();
    if (changed.length > 0) {
      await Promise.all(changed.map((v) => runVariableUpdate(v)));
    }

    applyExplicitDefaults();
  };

  variables[0].addActivationHandler(() => {
    const refreshTrigger$ = new Subject<void>();
    let initialLoadDone = false;

    // Serialize refreshes and coalesce synchronous bursts from variable state updates.
    // After the first pipeline completes, fire onReady so the caller can load panels
    // with the correct variable values already resolved from the URL.
    const refreshSub = refreshTrigger$
      .pipe(
        auditTime(0),
        concatMap(() =>
          from(runRefreshPipeline()).pipe(
            tap(() => {
              if (!initialLoadDone) {
                initialLoadDone = true;
                onReady?.();
              }
            }),
            catchError(() => {
              if (!initialLoadDone) {
                initialLoadDone = true;
                onReady?.();
              }
              return EMPTY;
            })
          )
        )
      )
      .subscribe();

    const subs = variables.map((variable) =>
      variable.subscribeToState(() => {
        refreshTrigger$.next();
      })
    );

    refreshTrigger$.next();

    return () => {
      refreshSub.unsubscribe();
      refreshTrigger$.complete();
      subs.forEach((s) => s.unsubscribe());
    };
  });

  return { variables };
}
