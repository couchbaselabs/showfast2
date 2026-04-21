import { of } from 'rxjs';
import { SceneObjectBase } from '../../core/SceneObjectBase.js';
import { sceneGraph } from '../../core/sceneGraph/index.js';
import { VariableDependencyConfig } from '../VariableDependencyConfig.js';
import { SceneVariableValueChangedEvent } from '../types.js';

class ConstantVariable extends SceneObjectBase {
  constructor(initialState) {
    super({
      type: "constant",
      value: "",
      name: "",
      ...initialState,
      skipUrlSync: true
    });
    this._variableDependency = new VariableDependencyConfig(this, {
      statePaths: ["value"]
    });
    this._prevValue = "";
  }
  /**
   * This function is called on when SceneVariableSet is activated or when a dependency changes.
   */
  validateAndUpdate() {
    const newValue = this.getValue();
    if (this._prevValue !== newValue) {
      this._prevValue = newValue;
      this.publishEvent(new SceneVariableValueChangedEvent(this), true);
    }
    return of({});
  }
  getValue() {
    if (typeof this.state.value === "string") {
      return sceneGraph.interpolate(this, this.state.value);
    }
    return this.state.value;
  }
}

export { ConstantVariable };
//# sourceMappingURL=ConstantVariable.js.map
