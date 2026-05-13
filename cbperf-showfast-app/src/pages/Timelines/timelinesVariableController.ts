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

export function createTimelineVariableController(
  onVariablesChanged?: () => void
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

  variables[0].addActivationHandler(() => {
    const subs = variables.map((variable) =>
      variable.subscribeToState(() => {
        const changed = syncQueries();
        changed.forEach((v) => v.validateAndUpdate().subscribe());
        onVariablesChanged?.();
      })
    );

    syncQueries();
    onVariablesChanged?.();

    return () => subs.forEach((s) => s.unsubscribe());
  });

  return { variables };
}
