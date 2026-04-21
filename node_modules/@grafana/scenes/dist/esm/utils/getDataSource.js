import { getDataSourceSrv } from '@grafana/runtime';
import { runtimeDataSources } from '../querying/RuntimeDataSource.js';
import { wrapPromiseInStateObservable, registerQueryWithController } from '../querying/registerQueryWithController.js';
import { sceneGraph } from '../core/sceneGraph/index.js';

async function getDataSource(datasource, scopedVars) {
  var _a;
  if (datasource == null ? void 0 : datasource.uid) {
    const runtimeDataSource = runtimeDataSources.get(datasource.uid);
    if (runtimeDataSource) {
      return runtimeDataSource;
    }
  }
  if (datasource && datasource.query) {
    return datasource;
  }
  const dsPromise = getDataSourceSrv().get(datasource, scopedVars);
  if (scopedVars.__sceneObject && scopedVars.__sceneObject.value.valueOf()) {
    const queryControler = sceneGraph.getQueryController(scopedVars.__sceneObject.value.valueOf());
    if (queryControler && queryControler.state.enableProfiling) {
      wrapPromiseInStateObservable(dsPromise).pipe(
        registerQueryWithController({
          type: `getDataSource/${(_a = datasource == null ? void 0 : datasource.type) != null ? _a : "unknown"}`,
          origin: scopedVars.__sceneObject.value.valueOf()
        })
      ).subscribe(() => {
      });
    }
  }
  const result = await dsPromise;
  return result;
}

export { getDataSource };
//# sourceMappingURL=getDataSource.js.map
