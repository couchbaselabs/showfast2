import { from, mergeMap, of } from 'rxjs';
import { LoadingState, getDefaultTimeRange } from '@grafana/data';
import { getRunRequest } from '@grafana/runtime';
import { hasStandardVariableSupport, hasLegacyVariableSupport, hasCustomVariableSupport, hasDataSourceVariableSupport } from './guards.js';

class StandardQueryRunner {
  constructor(datasource, _runRequest = getRunRequest()) {
    this.datasource = datasource;
    this._runRequest = _runRequest;
  }
  getTarget(variable) {
    if (hasStandardVariableSupport(this.datasource)) {
      return this.datasource.variables.toDataQuery(ensureVariableQueryModelIsADataQuery(variable));
    }
    throw new Error("Couldn't create a target with supplied arguments.");
  }
  runRequest(_, request) {
    if (!hasStandardVariableSupport(this.datasource)) {
      return getEmptyMetricFindValueObservable();
    }
    if (!this.datasource.variables.query) {
      return this._runRequest(this.datasource, request);
    }
    return this._runRequest(this.datasource, request, this.datasource.variables.query.bind(this.datasource.variables));
  }
}
class LegacyQueryRunner {
  constructor(datasource) {
    this.datasource = datasource;
  }
  getTarget(variable) {
    if (hasLegacyVariableSupport(this.datasource)) {
      return variable.state.query;
    }
    throw new Error("Couldn't create a target with supplied arguments.");
  }
  runRequest({ variable, searchFilter }, request) {
    if (!hasLegacyVariableSupport(this.datasource)) {
      return getEmptyMetricFindValueObservable();
    }
    return from(
      this.datasource.metricFindQuery(variable.state.query, {
        ...request,
        // variable is used by SQL common data source
        variable: {
          name: variable.state.name,
          type: variable.state.type
        },
        searchFilter
      })
    ).pipe(
      mergeMap((values) => {
        if (!values || !values.length) {
          return getEmptyMetricFindValueObservable();
        }
        const series = values;
        return of({ series, state: LoadingState.Done, timeRange: request.range });
      })
    );
  }
}
class CustomQueryRunner {
  constructor(datasource, _runRequest = getRunRequest()) {
    this.datasource = datasource;
    this._runRequest = _runRequest;
  }
  getTarget(variable) {
    if (hasCustomVariableSupport(this.datasource)) {
      return variable.state.query;
    }
    throw new Error("Couldn't create a target with supplied arguments.");
  }
  runRequest(_, request) {
    if (!hasCustomVariableSupport(this.datasource)) {
      return getEmptyMetricFindValueObservable();
    }
    if (!this.datasource.variables.query) {
      return this._runRequest(this.datasource, request);
    }
    return this._runRequest(this.datasource, request, this.datasource.variables.query.bind(this.datasource.variables));
  }
}
const variableDummyRefId = "variable-query";
class DatasourceQueryRunner {
  constructor(datasource, _runRequest = getRunRequest()) {
    this.datasource = datasource;
    this._runRequest = _runRequest;
  }
  getTarget(variable) {
    var _a;
    if (hasDataSourceVariableSupport(this.datasource)) {
      if (typeof variable.state.query === "string") {
        return variable.state.query;
      }
      return { ...variable.state.query, refId: (_a = variable.state.query.refId) != null ? _a : variableDummyRefId };
    }
    throw new Error("Couldn't create a target with supplied arguments.");
  }
  runRequest(_, request) {
    if (!hasDataSourceVariableSupport(this.datasource)) {
      return getEmptyMetricFindValueObservable();
    }
    return this._runRequest(this.datasource, request);
  }
}
function getEmptyMetricFindValueObservable() {
  return of({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
}
function createQueryVariableRunnerFactory(datasource) {
  if (hasStandardVariableSupport(datasource)) {
    return new StandardQueryRunner(datasource, getRunRequest());
  }
  if (hasLegacyVariableSupport(datasource)) {
    return new LegacyQueryRunner(datasource);
  }
  if (hasCustomVariableSupport(datasource)) {
    return new CustomQueryRunner(datasource);
  }
  if (hasDataSourceVariableSupport(datasource)) {
    return new DatasourceQueryRunner(datasource);
  }
  throw new Error(`Couldn't create a query runner for datasource ${datasource.type}`);
}
let createQueryVariableRunner = createQueryVariableRunnerFactory;
function ensureVariableQueryModelIsADataQuery(variable) {
  var _a;
  const query = (_a = variable.state.query) != null ? _a : "";
  if (typeof query === "string") {
    return { query, refId: `variable-${variable.state.name}` };
  }
  if (query.refId == null) {
    return { ...query, refId: `variable-${variable.state.name}` };
  }
  return variable.state.query;
}

export { createQueryVariableRunner };
//# sourceMappingURL=createQueryVariableRunner.js.map
