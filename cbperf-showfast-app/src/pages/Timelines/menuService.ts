import { getBackendSrv } from '@grafana/runtime';
import { API_BASE_URL } from '../../constants';
import { isIgnorableRequestError } from '../../utils/utils.requests';
import { MenuConfig } from './menuApiTypes';
import { TimelinePanel } from './timelinesApiTypes';

export async function fetchMenuConfig(): Promise<MenuConfig> {
  return getBackendSrv().get<MenuConfig>(`${API_BASE_URL}/menu`);
}

export async function fetchPanelsForView(component: string, category: string): Promise<TimelinePanel[]> {
  const url = `${API_BASE_URL}/timelines/panels?component=${encodeURIComponent(component)}&category=${encodeURIComponent(category)}`;
  try {
    return await getBackendSrv().get<TimelinePanel[]>(url);
  } catch (error) {
    if (isIgnorableRequestError(error)) {
      return [];
    }
    throw error;
  }
}
