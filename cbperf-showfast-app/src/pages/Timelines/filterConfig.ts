/**
 * Filter configuration for Timelines page.
 * Defines the filter variables, their query keys, and API endpoints.
 */

export const FILTER_DEFINITIONS = [
  { name: 'component', label: 'Component', endpoint: 'components', queryKey: 'component' },
  { name: 'category', label: 'Category', endpoint: 'categories', queryKey: 'category' },
  { name: 'subcategory', label: 'Subcategory', endpoint: 'subcategories', queryKey: 'subcategory' },
  { name: 'os', label: 'OS', endpoint: 'os', queryKey: 'os' },
  { name: 'cluster', label: 'Cluster', endpoint: 'clusters', queryKey: 'cluster' },
] as const;

export type FilterDefinition = (typeof FILTER_DEFINITIONS)[number];
export type VariableName = FilterDefinition['name'];
export type FilterEndpoint = FilterDefinition['endpoint'];
export type FilterQueryKey = FilterDefinition['queryKey'];

// Build both maps from FILTER_DEFINITIONS to avoid drift.
export const variableToQueryKey = FILTER_DEFINITIONS.reduce((acc, definition) => {
  acc[definition.name] = definition.queryKey;
  return acc;
}, {} as Record<VariableName, FilterQueryKey>);

export const endpointToVariable = FILTER_DEFINITIONS.reduce((acc, definition) => {
  acc[definition.endpoint] = definition.name;
  return acc;
}, {} as Record<FilterEndpoint, VariableName>);

export const SHOWFAST_FILTERS_RUNTIME_DATASOURCE_PLUGIN_ID = 'cbperf-showfast-app-filters-runtime';
export const SHOWFAST_FILTERS_RUNTIME_DATASOURCE_UID = 'cbperf-showfast-app-filters-runtime';


