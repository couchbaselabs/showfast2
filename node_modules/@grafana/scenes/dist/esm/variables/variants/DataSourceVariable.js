import { t } from '@grafana/i18n';
import { of } from 'rxjs';
import { stringToJsRegex } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { sceneGraph } from '../../core/sceneGraph/index.js';
import { VariableDependencyConfig } from '../VariableDependencyConfig.js';
import { MultiOrSingleValueSelect } from '../components/VariableValueSelect.js';
import { MultiValueVariable } from './MultiValueVariable.js';
import React from 'react';

class DataSourceVariable extends MultiValueVariable {
  constructor(initialState) {
    super({
      type: "datasource",
      value: "",
      text: "",
      options: [],
      name: "",
      regex: "",
      pluginId: "",
      ...initialState
    });
    this._variableDependency = new VariableDependencyConfig(this, {
      statePaths: ["regex"]
    });
  }
  getValueOptions(args) {
    if (!this.state.pluginId) {
      return of([]);
    }
    const dataSources = getDataSourceSrv().getList({ metrics: true, variables: false, pluginId: this.state.pluginId });
    let regex;
    if (this.state.regex) {
      const interpolated = sceneGraph.interpolate(this, this.state.regex, void 0, "regex");
      regex = stringToJsRegex(interpolated);
    }
    const options = [];
    for (let i = 0; i < dataSources.length; i++) {
      const source = dataSources[i];
      if (isValid(source, regex)) {
        options.push({ label: source.name, value: source.uid });
      }
      if (this.state.defaultOptionEnabled && isDefault(source, regex)) {
        options.push({
          label: t("grafana-scenes.variables.data-source-variable.label.default", "default"),
          value: "default"
        });
      }
    }
    if (options.length === 0) {
      this.setState({ error: "No data sources found" });
    } else if (this.state.error) {
      this.setState({ error: null });
    }
    return of(options);
  }
}
DataSourceVariable.Component = ({ model }) => {
  return /* @__PURE__ */ React.createElement(MultiOrSingleValueSelect, { model });
};
function isValid(source, regex) {
  if (!regex) {
    return true;
  }
  return regex.exec(source.name);
}
function isDefault(source, regex) {
  if (!source.isDefault) {
    return false;
  }
  if (!regex) {
    return true;
  }
  return regex.exec("default");
}

export { DataSourceVariable };
//# sourceMappingURL=DataSourceVariable.js.map
