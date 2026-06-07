import { getBackendSrv } from '@grafana/runtime';
import { API_BASE_URL } from '../../constants';
import { isIgnorableRequestError } from '../../utils/utils.requests';
import { buildTimelinesBarChartQueryParams } from '../../utils/utils.timelinesQueryParams';
import { FILTER_DEFINITIONS } from './filterConfig';
import { TimelinePanel } from './timelinesApiTypes';
import { selectedValuesForVariable } from './variableHelpers';

export async function fetchTimelineBarChartPanels(): Promise<TimelinePanel[]> {
  const params = buildTimelinesBarChartQueryParams(FILTER_DEFINITIONS, selectedValuesForVariable);
  const qs = params.toString();
  const url = `${API_BASE_URL}/timelines/panels${qs ? `?${qs}` : ''}`;
  try {
    return await getBackendSrv().get<TimelinePanel[]>(url);
  } catch (error) {
    if (isIgnorableRequestError(error)) {
      return [];
    }
    throw error;
  }
}
