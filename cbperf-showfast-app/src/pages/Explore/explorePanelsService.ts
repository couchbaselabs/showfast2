import { getBackendSrv } from '@grafana/runtime';
import { API_BASE_URL } from '../../constants';
import { isIgnorableRequestError } from '../../utils/utils.requests';
import { buildTimelinesBarChartQueryParams } from '../../utils/utils.timelinesQueryParams';
import { FILTER_DEFINITIONS } from '../Timelines/filterConfig';
import { TimelinePanel } from '../Timelines/timelinesApiTypes';
import { FilterValues, ExploreOptions, DEFAULT_EXPLORE_OPTIONS, applyExploreOptions } from './exploreFiltersService';

export interface PaginatedPanelsResponse {
  panels: TimelinePanel[];
  total: number;
  limit: number;
  offset: number;
}

export const EXPLORE_PAGE_SIZE = 20;

export async function fetchTimelineBarChartPanelsPage(
  selected: FilterValues,
  page: number,
  pageSize = EXPLORE_PAGE_SIZE,
  options: ExploreOptions = DEFAULT_EXPLORE_OPTIONS
): Promise<PaginatedPanelsResponse> {
  const params = buildTimelinesBarChartQueryParams(
    FILTER_DEFINITIONS,
    (filterName) => selected[filterName] ?? []
  );
  params.set('limit', String(pageSize));
  params.set('offset', String(page * pageSize));
  applyExploreOptions(params, options);
  const url = `${API_BASE_URL}/timelines/panels?${params.toString()}`;
  try {
    return await getBackendSrv().get<PaginatedPanelsResponse>(url);
  } catch (error) {
    if (isIgnorableRequestError(error)) {
      return { panels: [], total: 0, limit: pageSize, offset: page * pageSize };
    }
    throw error;
  }
}
