import { ReplaySubject } from 'rxjs';
import { emptyPanelData } from '../../core/SceneDataNode.js';
import { SceneObjectBase } from '../../core/SceneObjectBase.js';
import { setBaseClassState } from '../../utils/utils.js';
import { writeSceneLog } from '../../utils/writeSceneLog.js';
import { VariableDependencyConfig } from '../../variables/VariableDependencyConfig.js';
import { VariableValueRecorder } from '../../variables/VariableValueRecorder.js';

class SceneDataLayerBase extends SceneObjectBase {
  /**
   * For variables support in data layer provide variableDependencyStatePaths with keys of the state to be scanned for variables.
   */
  constructor(initialState, variableDependencyStatePaths = []) {
    super({
      isEnabled: true,
      ...initialState
    });
    /**
     * Subject to emit results to.
     */
    this._results = new ReplaySubject(1);
    /**
     * Mark data provider as data layer
     */
    this.isDataLayer = true;
    this._variableValueRecorder = new VariableValueRecorder();
    this._variableDependency = new VariableDependencyConfig(this, {
      onVariableUpdateCompleted: this.onVariableUpdateCompleted.bind(this),
      dependsOnScopes: true
    });
    this._variableDependency.setPaths(variableDependencyStatePaths);
    this.addActivationHandler(() => this.onActivate());
  }
  onActivate() {
    if (this.state.isEnabled) {
      this.onEnable();
    }
    if (this.shouldRunLayerOnActivate()) {
      this.runLayer();
    }
    this.subscribeToState((n, p) => {
      if (!n.isEnabled && this.querySub) {
        this.querySub.unsubscribe();
        this.querySub = void 0;
        this.onDisable();
        this._results.next({ origin: this, data: emptyPanelData });
        this.setStateHelper({ data: emptyPanelData });
      }
      if (n.isEnabled && !p.isEnabled) {
        this.onEnable();
        this.runLayer();
      }
    });
    return () => {
      this.onDeactivate();
    };
  }
  onDeactivate() {
    if (this.querySub) {
      this.querySub.unsubscribe();
      this.querySub = void 0;
    }
    this.onDisable();
    this._variableValueRecorder.recordCurrentDependencyValuesForSceneObject(this);
  }
  onVariableUpdateCompleted() {
    this.runLayer();
  }
  cancelQuery() {
    if (this.querySub) {
      this.querySub.unsubscribe();
      this.querySub = void 0;
      this.publishResults(emptyPanelData);
    }
  }
  publishResults(data) {
    if (this.state.isEnabled) {
      this._results.next({ origin: this, data });
      this.setStateHelper({ data });
    }
  }
  getResultsStream() {
    return this._results;
  }
  shouldRunLayerOnActivate() {
    if (!this.state.isEnabled) {
      return false;
    }
    if (this._variableValueRecorder.hasDependenciesChanged(this)) {
      writeSceneLog(
        "SceneDataLayerBase",
        "Variable dependency changed while inactive, shouldRunLayerOnActivate returns true"
      );
      return true;
    }
    if (!this.state.data) {
      return true;
    }
    return false;
  }
  /**
   * This helper function is to counter the contravariance of setState
   */
  setStateHelper(state) {
    setBaseClassState(this, state);
  }
}

export { SceneDataLayerBase };
//# sourceMappingURL=SceneDataLayerBase.js.map
