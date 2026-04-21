import { DataLinkBuiltInVars } from '@grafana/data';
import { sceneGraph } from '../core/sceneGraph/index.js';
import { writeSceneLog } from '../utils/writeSceneLog.js';
import { SCOPES_VARIABLE_NAME, VARIABLE_REGEX } from './constants.js';
import { safeStringifyValue } from './utils.js';
import { ConstantVariable } from './variants/ConstantVariable.js';

class VariableDependencyConfig {
  constructor(_sceneObject, _options) {
    this._sceneObject = _sceneObject;
    this._options = _options;
    this._dependencies = /* @__PURE__ */ new Set();
    this._isWaitingForVariables = false;
    this.scanCount = 0;
    this._statePaths = _options.statePaths;
    if (this._options.handleTimeMacros) {
      this.handleTimeMacros();
    }
  }
  /**
   * Used to check for dependency on a specific variable
   */
  hasDependencyOn(name) {
    return this.getNames().has(name);
  }
  /**
   * This is called whenever any set of variables have new values. It is up to this implementation to check if it's relevant given the current dependencies.
   */
  variableUpdateCompleted(variable, hasChanged) {
    var _a, _b, _c, _d;
    const deps = this.getNames();
    const dependencyChanged = (deps.has(variable.state.name) || deps.has(DataLinkBuiltInVars.includeVars)) && hasChanged;
    writeSceneLog(
      "VariableDependencyConfig",
      "variableUpdateCompleted",
      variable.state.name,
      dependencyChanged,
      this._isWaitingForVariables
    );
    (_b = (_a = this._options).onAnyVariableChanged) == null ? void 0 : _b.call(_a, variable);
    if (this._options.onVariableUpdateCompleted && (this._isWaitingForVariables || dependencyChanged)) {
      this._options.onVariableUpdateCompleted();
    }
    if (dependencyChanged) {
      (_d = (_c = this._options).onReferencedVariableValueChanged) == null ? void 0 : _d.call(_c, variable);
      if (!this._options.onReferencedVariableValueChanged && !this._options.onVariableUpdateCompleted) {
        this._sceneObject.forceRender();
      }
    }
  }
  hasDependencyInLoadingState() {
    this._isWaitingForVariables = sceneGraph.hasVariableDependencyInLoadingState(this._sceneObject);
    return this._isWaitingForVariables;
  }
  getNames() {
    const prevState = this._state;
    const newState = this._state = this._sceneObject.state;
    const noPreviousState = !prevState;
    const stateDiffers = newState !== prevState;
    const shouldScanForDependencies = noPreviousState || stateDiffers && (!this._statePaths || this._statePaths.some((path) => path === "*" || newState[path] !== prevState[path]));
    if (shouldScanForDependencies) {
      this.scanStateForDependencies(newState);
    }
    return this._dependencies;
  }
  /**
   * Update variableNames
   */
  setVariableNames(varNames) {
    this._options.variableNames = varNames;
    this.scanStateForDependencies(this._state);
  }
  setPaths(paths) {
    this._statePaths = paths;
  }
  scanStateForDependencies(state) {
    this._dependencies.clear();
    this.scanCount++;
    if (this._options.variableNames) {
      for (const name of this._options.variableNames) {
        this._dependencies.add(name);
      }
    }
    if (this._options.dependsOnScopes) {
      this._dependencies.add(SCOPES_VARIABLE_NAME);
    }
    if (this._statePaths) {
      for (const path of this._statePaths) {
        if (path === "*") {
          this.extractVariablesFrom(state);
          break;
        } else {
          const value = state[path];
          if (value) {
            this.extractVariablesFrom(value);
          }
        }
      }
    }
  }
  extractVariablesFrom(value) {
    VARIABLE_REGEX.lastIndex = 0;
    const stringToCheck = typeof value !== "string" ? safeStringifyValue(value) : value;
    const matches = stringToCheck.matchAll(VARIABLE_REGEX);
    if (!matches) {
      return;
    }
    for (const match of matches) {
      const [, var1, var2, , var3] = match;
      const variableName = var1 || var2 || var3;
      this._dependencies.add(variableName);
    }
  }
  handleTimeMacros() {
    this._sceneObject.addActivationHandler(() => {
      const timeRange = sceneGraph.getTimeRange(this._sceneObject);
      const sub = timeRange.subscribeToState((newState, oldState) => {
        const deps = this.getNames();
        const hasFromDep = deps.has("__from");
        const hasToDep = deps.has("__to");
        const hasTimeZone = deps.has("__timezone");
        if (newState.value !== oldState.value) {
          if (hasFromDep) {
            const variable = new ConstantVariable({ name: "__from", value: newState.from });
            this.variableUpdateCompleted(variable, true);
          } else if (hasToDep) {
            const variable = new ConstantVariable({ name: "__to", value: newState.to });
            this.variableUpdateCompleted(variable, true);
          }
        }
        if (newState.timeZone !== oldState.timeZone && hasTimeZone) {
          const variable = new ConstantVariable({ name: "__timezone", value: newState.timeZone });
          this.variableUpdateCompleted(variable, true);
        }
      });
      return () => sub.unsubscribe();
    });
  }
}

export { VariableDependencyConfig };
//# sourceMappingURL=VariableDependencyConfig.js.map
