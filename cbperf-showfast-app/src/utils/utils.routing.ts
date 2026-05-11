import { PLUGIN_BASE_URL, ROUTES } from '../constants';

export const ROUTE_PATHS = {
  search: () => `/${ROUTES.Search}`,
  timelines: () => `/${ROUTES.Timelines}`,
  home: () => `/${ROUTES.Timelines}`,
}

// Prefixes the route with the base URL of the plugin
export function prefixRoute(route: string): string {
  if (route.startsWith('/')) {
    return `${PLUGIN_BASE_URL}${route}`;
  }
  return `${PLUGIN_BASE_URL}/${route}`;
}
