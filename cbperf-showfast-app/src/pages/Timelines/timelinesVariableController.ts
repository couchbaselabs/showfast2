/**
 * Orchestrates Timelines filter-variable lifecycle and dependency synchronization.
 * Scene composition should stay in timelinesScene.ts.
 */

import { QueryVariable } from '@grafana/scenes';
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

export function createTimelineVariableController(
  onVariablesChanged?: () => void | Promise<void>
): TimelineVariableController {
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

  let refreshInFlight = false;
  let refreshQueued = false;

  // Deterministic refresh pipeline:
  // 1) sync variable queries
  // 2) refresh dependent variable options
  // 3) trigger external panel refresh callback once
  const runRefreshPipeline = async (): Promise<void> => {
    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }

    refreshInFlight = true;
    do {
      refreshQueued = false;

      const changed = syncQueries();
      if (changed.length > 0) {
        await Promise.all(changed.map((v) => runVariableUpdate(v)));
      }

      if (onVariablesChanged) {
        await onVariablesChanged();
      }
    } while (refreshQueued);

    refreshInFlight = false;
  };

  variables[0].addActivationHandler(() => {
    const subs = variables.map((variable) =>
      variable.subscribeToState(() => {
        void runRefreshPipeline();
      })
    );

    void runRefreshPipeline();

    return () => subs.forEach((s) => s.unsubscribe());
  });

  return { variables };
}
