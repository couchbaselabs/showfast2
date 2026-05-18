/**
 * Variable helper functions for the Timelines page.
 * Manages template variable state and query building.
 */

import { getTemplateSrv, locationService } from '@grafana/runtime';
import { QueryVariable } from '@grafana/scenes';
import { CleanUrlQueryVariable } from './cleanUrlQueryVariable';
import {
  VariableName,
  FilterEndpoint,
  variableToQueryKey,
  FILTER_DEFINITIONS,
  SHOWFAST_FILTERS_RUNTIME_DATASOURCE_UID,
  SHOWFAST_FILTERS_RUNTIME_DATASOURCE_PLUGIN_ID,
} from './filterConfig';

/**
 * Extract selected values for a template variable, filtering out special values.
 */
export function selectedValuesForVariable(name: string): string[] {
  const templateSrv = getTemplateSrv();
  const values: string[] = [];

  templateSrv.replace(`$${name}`, {}, (value: string | string[]) => {
    if (Array.isArray(value)) {
      values.push(...value);
    } else {
      values.push(value);
    }
    return '';
  });

  return values
    .map((value) => value.trim())
    .filter((value) => value !== '' && value !== '$__all' && value !== '*')
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

/**
 * Parse a query key (e.g., "component") back to a VariableName.
 */
export function parseVariableNameFromQueryKey(queryKey: string): VariableName | null {
  const match = (Object.entries(variableToQueryKey) as Array<[VariableName, string]>).find(
    ([, value]) => value === queryKey
  );
  return match ? match[0] : null;
}

/**
 * Build URL search params from selected template variable values.
 */
export function buildFilterParamsFromDependencies(dependencies: VariableName[]): URLSearchParams {
  const params = new URLSearchParams();

  dependencies.forEach((variableName) => {
    const queryKey = variableToQueryKey[variableName];
    for (const value of selectedValuesForVariable(variableName)) {
      params.append(queryKey, value);
    }
  });

  return appendUrlTagParams(params);
}

/**
 * Append tag.* query params from the current page URL.
 */
export function appendUrlTagParams(params: URLSearchParams): URLSearchParams {
  const seen = new Set<string>();
  const appendPair = (key: string, value: string) => {
    const dedupeKey = `${key}=${value}`;
    if (seen.has(dedupeKey)) {
      return;
    }
    params.append(key, value);
    seen.add(dedupeKey);
  };

  const appendIfValid = (key: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') {
      return;
    }

    let tagKey = '';
    if (key.startsWith('tag.')) {
      tagKey = key.slice('tag.'.length);
    } else if (key.startsWith('var-tag.')) {
      tagKey = key.slice('var-tag.'.length);
    }

    if (tagKey === '') {
      return;
    }

    appendPair(`tag.${tagKey}`, trimmed);
  };

  // Prefer Grafana's location state because it tracks the active route params.
  const searchObject = locationService.getSearchObject() as Record<string, unknown>;
  for (const [key, value] of Object.entries(searchObject)) {
    if (!key.startsWith('tag.') && !key.startsWith('var-tag.')) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          appendIfValid(key, item);
        }
      }
      continue;
    }

    if (typeof value === 'string') {
      appendIfValid(key, value);
    }
  }

  if (typeof window === 'undefined') {
    return params;
  }

  const pageParams = new URLSearchParams(window.location.search);
  for (const [key, value] of pageParams.entries()) {
    appendIfValid(key, value);
  }

  return params;
}

/**
 * Create a QueryVariable for a filter definition.
 */
export function createFilterVariable(
  name: VariableName,
  label: string,
  endpoint: FilterEndpoint
): QueryVariable {
  return new CleanUrlQueryVariable({
    name,
    label,
    datasource: {
      uid: SHOWFAST_FILTERS_RUNTIME_DATASOURCE_UID,
      type: SHOWFAST_FILTERS_RUNTIME_DATASOURCE_PLUGIN_ID,
    },
    query: endpoint,
    isMulti: true,
    includeAll: true,
    defaultToAll: true,
    allValue: '*',
  });
}

/**
 * Build a query string for a filter endpoint based on active dependencies.
 */
export function buildVariableQuery(endpoint: FilterEndpoint, dependencies: VariableName[]): string {
  const activeDependencies = dependencies.filter((name) => selectedValuesForVariable(name).length > 0);
  if (activeDependencies.length === 0) {
    return endpoint;
  }

  const query = activeDependencies.map((name) => `${variableToQueryKey[name]}=$${name}`).join('&');
  return `${endpoint}?${query}`;
}

/**
 * Update a variable's query if it has changed.
 * Returns true if the query was updated.
 */
export function setQueryIfChanged(variable: QueryVariable, query: string): boolean {
  if (variable.state.query !== query) {
    variable.setState({ query });
    return true;
  }
  return false;
}

/**
 * Get all filter variables except the one named.
 */
export function getPeerDependencies(variableName: VariableName): VariableName[] {
  return FILTER_DEFINITIONS.map((definition) => definition.name).filter((name) => name !== variableName);
}
