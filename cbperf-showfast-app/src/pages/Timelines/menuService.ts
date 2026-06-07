import { getBackendSrv } from '@grafana/runtime';
import { API_BASE_URL } from '../../constants';
import { isIgnorableRequestError } from '../../utils/utils.requests';
import { ComponentConfig, VariantsConfig } from './menuApiTypes';
import { TimelinePanel } from './timelinesApiTypes';

export async function fetchVariantsConfig(): Promise<VariantsConfig> {
  return getBackendSrv().get<VariantsConfig>(`${API_BASE_URL}/menu/variants`);
}

export async function fetchComponentConfig(id: string): Promise<ComponentConfig> {
  return getBackendSrv().get<ComponentConfig>(`${API_BASE_URL}/menu/component/${encodeURIComponent(id)}`);
}

/**
 * Fetch panels for a component+category view.
 * dbComponents is the list of DB-level component IDs to query (from ComponentConfig.dbComponentIDs()).
 */
export async function fetchPanelsForView(dbComponents: string[], category: string): Promise<TimelinePanel[]> {
  const params = dbComponents.map((c) => `component=${encodeURIComponent(c)}`).join('&');
  const url = `${API_BASE_URL}/timelines/panels?${params}&category=${encodeURIComponent(category)}`;
  try {
    return await getBackendSrv().get<TimelinePanel[]>(url);
  } catch (error) {
    if (isIgnorableRequestError(error)) {
      return [];
    }
    throw error;
  }
}
