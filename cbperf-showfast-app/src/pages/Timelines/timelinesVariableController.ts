/**
 * Orchestrates Timelines filter-variable lifecycle and dependency synchronization.
 * Scene composition should stay in timelinesScene.ts.
 */

import { QueryVariable } from '@grafana/scenes';
import { Subject, from, EMPTY } from 'rxjs';
import { auditTime, concatMap, catchError } from 'rxjs/operators';
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

function runVariableUpdate(variable: QueryVariable): Promise<void> {
  return new Promise((resolve) => {
    variable.validateAndUpdate().subscribe({
      complete: () => resolve(),
      error: () => resolve(),
    });
  });
}

export function createTimelineVariableController(): TimelineVariableController {
  const variableMap = FILTER_DEFINITIONS.reduce((acc, definition) => {
    acc[definition.name] = createFilterVariable(definition.name, definition.label, definition.endpoint);
    return acc;
  }, {} as Record<VariableName, QueryVariable>);

  const variables = FILTER_DEFINITIONS.map((definition) => variableMap[definition.name]);

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
  };

  variables[0].addActivationHandler(() => {
    const refreshTrigger$ = new Subject<void>();

    // Serialize refreshes and coalesce synchronous bursts from variable state updates.
    const refreshSub = refreshTrigger$
      .pipe(
        auditTime(0),
        concatMap(() =>
          from(runRefreshPipeline()).pipe(
            catchError(() => {
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
