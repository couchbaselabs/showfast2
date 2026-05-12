import pluginJson from './plugin.json';

export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;
export const API_BASE_URL = `/api/plugins/${pluginJson.id}/resources`;

export const ROUTES = {
  Home: '',
  Timelines: 'timelines',
  Search: 'search',
}

export const DATASOURCE_REF = {
  uid: 'showfast_api',
  type: 'yesoreyeram-infinity-datasource',
} as const;
