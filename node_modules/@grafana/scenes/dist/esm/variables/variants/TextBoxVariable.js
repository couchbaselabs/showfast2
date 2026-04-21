import React from 'react';
import { SceneObjectBase } from '../../core/SceneObjectBase.js';
import { SceneObjectUrlSyncConfig } from '../../services/SceneObjectUrlSyncConfig.js';
import { VariableValueInput } from '../components/VariableValueInput.js';
import { SceneVariableValueChangedEvent } from '../types.js';

class TextBoxVariable extends SceneObjectBase {
  constructor(initialState) {
    super({
      type: "textbox",
      value: "",
      name: "",
      ...initialState
    });
    this._urlSync = new SceneObjectUrlSyncConfig(this, { keys: () => this.getKeys() });
  }
  getValue() {
    return this.state.value;
  }
  setValue(newValue) {
    if (newValue !== this.state.value) {
      this.setState({ value: newValue });
      this.publishEvent(new SceneVariableValueChangedEvent(this), true);
    }
  }
  getKey() {
    return `var-${this.state.name}`;
  }
  getKeys() {
    if (this.state.skipUrlSync) {
      return [];
    }
    return [this.getKey()];
  }
  getUrlState() {
    if (this.state.skipUrlSync) {
      return {};
    }
    return { [this.getKey()]: this.state.value };
  }
  updateFromUrl(values) {
    const val = values[this.getKey()];
    if (typeof val === "string") {
      this.setValue(val);
    }
  }
}
TextBoxVariable.Component = ({ model }) => {
  return /* @__PURE__ */ React.createElement(VariableValueInput, { model });
};

export { TextBoxVariable };
//# sourceMappingURL=TextBoxVariable.js.map
