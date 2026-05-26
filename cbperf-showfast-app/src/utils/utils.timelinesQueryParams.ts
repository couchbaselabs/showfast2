import { locationService } from '@grafana/runtime';

type FilterDefinitionLike = {
  name: string;
  queryKey: string;
};

type SelectedValuesProvider = (filterName: string) => string[];

/**
 * Append tag.* query params from the active URL and dedupe repeated values.
 */
export function appendTagQueryParamsFromCurrentUrl(params: URLSearchParams): URLSearchParams {
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
 * Build query params for Timelines bar chart panel requests.
 */
export function buildTimelinesBarChartQueryParams(
  filterDefinitions: readonly FilterDefinitionLike[],
  selectedValuesForFilter: SelectedValuesProvider
): URLSearchParams {
  const params = new URLSearchParams();

  for (const definition of filterDefinitions) {
    const values = selectedValuesForFilter(definition.name);
    for (const value of values) {
      params.append(definition.queryKey, value);
    }
  }

  return appendTagQueryParamsFromCurrentUrl(params);
}
