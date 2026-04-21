import { t } from '@grafana/i18n';
import { Subject, Observable } from 'rxjs';
import { sceneGraph } from '../../core/sceneGraph/index.js';
import { queryMetricTree } from '../../utils/metricTree.js';
import { VariableDependencyConfig } from '../VariableDependencyConfig.js';
import { MultiOrSingleValueSelect } from '../components/VariableValueSelect.js';
import { MultiValueVariable } from './MultiValueVariable.js';
import { VariableRefresh } from '@grafana/data';
import { getClosest } from '../../core/sceneGraph/utils.js';
import { SceneVariableSet } from '../sets/SceneVariableSet.js';
import React from 'react';

class TestVariable extends MultiValueVariable {
  constructor(initialState, isLazy = false) {
    super({
      type: "custom",
      name: "Test",
      value: "Value",
      text: t("grafana-scenes.variables.test-variable.text.text", "Text"),
      query: "Query",
      options: [],
      refresh: VariableRefresh.onDashboardLoad,
      updateOptions: true,
      ...initialState
    });
    this.completeUpdate = new Subject();
    this.isGettingValues = true;
    this.getValueOptionsCount = 0;
    this.isLazy = false;
    this._variableDependency = new VariableDependencyConfig(this, {
      statePaths: ["query"]
    });
    this.isLazy = isLazy;
  }
  getValueOptions(args) {
    const { delayMs } = this.state;
    this.getValueOptionsCount += 1;
    const queryController = sceneGraph.getQueryController(this);
    return new Observable((observer) => {
      const queryEntry = {
        type: "variable",
        origin: this,
        cancel: () => observer.complete()
      };
      if (queryController) {
        queryController.queryStarted(queryEntry);
      }
      this.setState({ loading: true });
      if (this.state.throwError) {
        throw new Error(this.state.throwError);
      }
      const interpolatedQuery = sceneGraph.interpolate(this, this.state.query);
      const options = this.getOptions(interpolatedQuery);
      const sub = this.completeUpdate.subscribe({
        next: () => {
          const newState = { issuedQuery: interpolatedQuery, loading: false };
          if (this.state.updateOptions) {
            newState.options = options;
          }
          this.setState(newState);
          observer.next(options);
          observer.complete();
        }
      });
      let timeout;
      if (delayMs) {
        timeout = window.setTimeout(() => this.signalUpdateCompleted(), delayMs);
      } else if (delayMs === 0) {
        this.signalUpdateCompleted();
      }
      this.isGettingValues = true;
      return () => {
        sub.unsubscribe();
        window.clearTimeout(timeout);
        this.isGettingValues = false;
        if (this.state.loading) {
          this.setState({ loading: false });
        }
        if (queryController) {
          queryController.queryCompleted(queryEntry);
        }
      };
    });
  }
  cancel() {
    const sceneVarSet = getClosest(this, (s) => s instanceof SceneVariableSet ? s : void 0);
    sceneVarSet == null ? void 0 : sceneVarSet.cancel(this);
  }
  getOptions(interpolatedQuery) {
    if (this.state.optionsToReturn) {
      return this.state.optionsToReturn;
    }
    return queryMetricTree(interpolatedQuery).map((x) => ({ label: x.name, value: x.name }));
  }
  /** Useful from tests */
  signalUpdateCompleted() {
    this.completeUpdate.next(1);
  }
}
TestVariable.Component = ({ model }) => {
  return /* @__PURE__ */ React.createElement(MultiOrSingleValueSelect, { model });
};

export { TestVariable };
//# sourceMappingURL=TestVariable.js.map
