import { lastValueFrom, of, from, mergeMap, filter, take, throwError, catchError } from 'rxjs';
import { v4 } from 'uuid';
import { VariableSort, VariableRefresh, LoadingState, CoreApp } from '@grafana/data';
import { sceneGraph } from '../../../core/sceneGraph/index.js';
import { VariableDependencyConfig } from '../../VariableDependencyConfig.js';
import { MultiOrSingleValueSelect } from '../../components/VariableValueSelect.js';
import { MultiValueVariable } from '../MultiValueVariable.js';
import { createQueryVariableRunner } from './createQueryVariableRunner.js';
import { metricNamesToVariableValues, sortVariableValues } from './utils.js';
import { toMetricFindValues } from './toMetricFindValues.js';
import { getDataSource } from '../../../utils/getDataSource.js';
import { safeStringifyValue } from '../../utils.js';
import { SEARCH_FILTER_VARIABLE } from '../../constants.js';
import { debounce } from 'lodash';
import { registerQueryWithController } from '../../../querying/registerQueryWithController.js';
import { wrapInSafeSerializableSceneObject } from '../../../utils/wrapInSafeSerializableSceneObject.js';
import React from 'react';

class QueryVariable extends MultiValueVariable {
  constructor(initialState) {
    super({
      type: "query",
      name: "",
      value: "",
      text: "",
      options: [],
      datasource: null,
      regex: "",
      query: "",
      regexApplyTo: "value",
      refresh: VariableRefresh.onDashboardLoad,
      sort: VariableSort.disabled,
      ...initialState
    });
    this._variableDependency = new VariableDependencyConfig(this, {
      statePaths: ["regex", "regexApplyTo", "query", "datasource"]
    });
    this.onSearchChange = (searchFilter) => {
      if (!containsSearchFilter(this.state.query)) {
        return;
      }
      this._updateOptionsBasedOnSearchFilter(searchFilter);
    };
    this._updateOptionsBasedOnSearchFilter = debounce(async (searchFilter) => {
      const result = await lastValueFrom(this.getValueOptions({ searchFilter }));
      this.setState({ options: result, loading: false });
    }, 400);
  }
  getValueOptions(args) {
    if (!this.state.query) {
      return of([]);
    }
    this.setState({ loading: true, error: null });
    return from(
      getDataSource(this.state.datasource, {
        __sceneObject: wrapInSafeSerializableSceneObject(this)
      })
    ).pipe(
      mergeMap((ds) => {
        const runner = createQueryVariableRunner(ds);
        const target = runner.getTarget(this);
        const request = this.getRequest(target, args.searchFilter);
        return runner.runRequest({ variable: this, searchFilter: args.searchFilter }, request).pipe(
          registerQueryWithController({
            type: "QueryVariable/getValueOptions",
            request,
            origin: this
          }),
          filter((data) => data.state === LoadingState.Done || data.state === LoadingState.Error),
          // we only care about done or error for now
          take(1),
          // take the first result, using first caused a bug where it in some situations throw an uncaught error because of no results had been received yet
          mergeMap((data) => {
            if (data.state === LoadingState.Error) {
              return throwError(() => data.error);
            }
            return of(data);
          }),
          toMetricFindValues(),
          mergeMap((values) => {
            let regex = "";
            if (this.state.regex) {
              regex = sceneGraph.interpolate(this, this.state.regex, void 0, "regex");
            }
            let options = metricNamesToVariableValues({
              variableRegEx: regex,
              variableRegexApplyTo: this.state.regexApplyTo,
              sort: this.state.sort,
              metricNames: values
            });
            if (this.state.staticOptions) {
              const customOptions = this.state.staticOptions;
              options = options.filter((option) => !customOptions.find((custom) => custom.value === option.value));
              if (this.state.staticOptionsOrder === "after") {
                options.push(...customOptions);
              } else if (this.state.staticOptionsOrder === "sorted") {
                options = sortVariableValues(options.concat(customOptions), this.state.sort);
              } else {
                options.unshift(...customOptions);
              }
            }
            return of(options);
          }),
          catchError((error) => {
            if (error.cancelled) {
              return of([]);
            }
            return throwError(() => error);
          })
        );
      })
    );
  }
  getRequest(target, searchFilter) {
    const scopedVars = {
      __sceneObject: wrapInSafeSerializableSceneObject(this)
    };
    if (searchFilter) {
      scopedVars.__searchFilter = { value: searchFilter, text: searchFilter };
    }
    const range = sceneGraph.getTimeRange(this).state.value;
    const request = {
      app: CoreApp.Dashboard,
      requestId: v4(),
      timezone: "",
      range,
      interval: "",
      intervalMs: 0,
      // @ts-ignore
      targets: [target],
      scopedVars,
      startTime: Date.now()
    };
    return request;
  }
}
QueryVariable.Component = ({ model }) => {
  return /* @__PURE__ */ React.createElement(MultiOrSingleValueSelect, { model });
};
function containsSearchFilter(query) {
  const str = safeStringifyValue(query);
  return str.indexOf(SEARCH_FILTER_VARIABLE) > -1;
}

export { QueryVariable };
//# sourceMappingURL=QueryVariable.js.map
