import { getBackendSrv } from '@grafana/runtime';
import { API_BASE_URL } from '../../constants';
import { FILTER_DEFINITIONS } from './filterConfig';

export type FilterValues = Partial<Record<string, string[]>>;

export interface ExploreOptions {
  showHiddenMetrics: boolean;
  showHiddenBenchmarks: boolean;
}

export const DEFAULT_EXPLORE_OPTIONS: ExploreOptions = {
  showHiddenMetrics: false,
  showHiddenBenchmarks: false,
};

export interface BulkFilters {
  component: string[];
  category: string[];
  subcategory: string[];
  cluster: string[];
  os: string[];
  pipelineGroup: string[];
  serverMajorMinor: string[];
}

function applyExploreOptions(params: URLSearchParams, options: ExploreOptions): void {
  if (options.showHiddenMetrics) {
    params.set('showHiddenMetrics', 'true');
  }
  if (options.showHiddenBenchmarks) {
    params.set('showHiddenBenchmarks', 'true');
  }
}

export async function fetchBulkFilters(
  selected: FilterValues = {},
  options: ExploreOptions = DEFAULT_EXPLORE_OPTIONS
): Promise<BulkFilters> {
  const params = new URLSearchParams();
  for (const def of FILTER_DEFINITIONS) {
    for (const v of selected[def.name] ?? []) {
      params.append(def.queryKey, v);
    }
  }
  applyExploreOptions(params, options);
  const qs = params.toString();
  return getBackendSrv().get<BulkFilters>(`${API_BASE_URL}/filters/bulk${qs ? `?${qs}` : ''}`);
}

export { applyExploreOptions };

// Module-level promise: starts on first call, shared by all subsequent callers.
// Called from explorePage.ts so the fetch begins when the plugin loads,
// not when the user first navigates to Explore.
let _unfilteredPrefetch: Promise<BulkFilters> | null = null;

export function prefetchUnfilteredFilters(): void {
  if (!_unfilteredPrefetch) {
    _unfilteredPrefetch = fetchBulkFilters({});
  }
}

export function getUnfilteredFilters(): Promise<BulkFilters> {
  if (!_unfilteredPrefetch) {
    _unfilteredPrefetch = fetchBulkFilters({});
  }
  // If the in-flight or cached promise rejects, clear it so the next caller retries.
  return _unfilteredPrefetch.catch((err: unknown) => {
    _unfilteredPrefetch = null;
    return Promise.reject(err);
  });
}
