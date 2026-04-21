import { useUrlSync } from './useUrlSync.js';

function UrlSyncContextProvider({
  children,
  scene,
  updateUrlOnInit,
  createBrowserHistorySteps,
  namespace,
  excludeFromNamespace
}) {
  const isInitialized = useUrlSync(scene, {
    updateUrlOnInit,
    createBrowserHistorySteps,
    namespace,
    excludeFromNamespace
  });
  if (!isInitialized) {
    return null;
  }
  return children;
}

export { UrlSyncContextProvider };
//# sourceMappingURL=UrlSyncContextProvider.js.map
