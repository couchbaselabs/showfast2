import { getBackendSrv } from '@grafana/runtime';
import { API_BASE_URL } from '../../constants';
import { FILTER_DEFINITIONS, variableToQueryKey } from './filterConfig';
import { TimelinePanel } from './timelinesApiTypes';
import { appendUrlTagParams, selectedValuesForVariable } from './variableHelpers';

function buildPanelsQueryParams(): URLSearchParams {
  const params = new URLSearchParams();

  for (const definition of FILTER_DEFINITIONS) {
    const values = selectedValuesForVariable(definition.name);
    const queryKey = variableToQueryKey[definition.name];
    for (const value of values) {
      params.append(queryKey, value);
    }
  }

  return appendUrlTagParams(params);
}

export async function fetchTimelinePanels(): Promise<TimelinePanel[]> {
  const params = buildPanelsQueryParams();
  const qs = params.toString();
  const url = `${API_BASE_URL}/timelines/panels${qs ? `?${qs}` : ''}`;
  return getBackendSrv().get<TimelinePanel[]>(url);
}
