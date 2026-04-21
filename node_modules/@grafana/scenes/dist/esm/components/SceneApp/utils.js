import { useParams, useLocation, matchPath } from 'react-router-dom';
import { urlUtil, locationUtil } from '@grafana/data';
import { locationSearchToObject } from '@grafana/runtime';

function useAppQueryParams() {
  const location = useLocation();
  return locationSearchToObject(location.search || "");
}
function getUrlWithAppState(path, searchObject, preserveParams) {
  const paramsCopy = { ...searchObject };
  if (preserveParams) {
    for (const key of Object.keys(paramsCopy)) {
      if (!preserveParams.includes(key)) {
        delete paramsCopy[key];
      }
    }
  }
  return urlUtil.renderUrl(locationUtil.assureBaseUrl(path), paramsCopy);
}
function useSceneRouteMatch(path) {
  const params = useParams();
  const location = useLocation();
  const isExact = matchPath(
    {
      path,
      caseSensitive: false,
      end: true
    },
    location.pathname
  );
  const match = {
    params,
    isExact: isExact !== null,
    path: location.pathname,
    url: location.pathname
  };
  return match;
}

export { getUrlWithAppState, useAppQueryParams, useSceneRouteMatch };
//# sourceMappingURL=utils.js.map
