import { toUrlCommaDelimitedString, unescapeUrlDelimiters } from '../utils.js';

class GroupByVariableUrlSyncHandler {
  constructor(_sceneObject) {
    this._sceneObject = _sceneObject;
    this._nextChangeShouldAddHistoryStep = false;
  }
  getRestorableKey() {
    return `restorable-var-${this._sceneObject.state.name}`;
  }
  getKey() {
    return `var-${this._sceneObject.state.name}`;
  }
  getKeys() {
    if (this._sceneObject.state.skipUrlSync) {
      return [];
    }
    return [this.getKey(), this.getRestorableKey()];
  }
  getUrlState() {
    if (this._sceneObject.state.skipUrlSync) {
      return {};
    }
    return {
      [this.getKey()]: this._sceneObject.state.defaultValue && !this._sceneObject.state.restorable ? [""] : toUrlValues(this._sceneObject.state.value, this._sceneObject.state.text),
      [this.getRestorableKey()]: this._sceneObject.state.defaultValue ? this._sceneObject.state.restorable ? "true" : "false" : null
    };
  }
  updateFromUrl(values) {
    let urlValue = values[this.getKey()];
    let restorableValue = values[this.getRestorableKey()];
    if (urlValue != null) {
      if (!this._sceneObject.isActive) {
        this._sceneObject.skipNextValidation = true;
      }
      const { values: values2, texts } = fromUrlValues(urlValue);
      if (this._sceneObject.state.defaultValue && (restorableValue === "false" || restorableValue === void 0)) {
        return;
      }
      if (restorableValue === "false") {
        this._sceneObject.changeValueTo([], [], false);
        return;
      }
      this._sceneObject.changeValueTo(values2, texts);
    }
  }
  performBrowserHistoryAction(callback) {
    this._nextChangeShouldAddHistoryStep = true;
    callback();
    this._nextChangeShouldAddHistoryStep = false;
  }
  shouldCreateHistoryStep(values) {
    return this._nextChangeShouldAddHistoryStep;
  }
}
function toUrlValues(values, texts) {
  values = Array.isArray(values) ? values : [values];
  texts = Array.isArray(texts) ? texts : [texts];
  return values.map((value, idx) => {
    if (value === void 0 || value === null) {
      return "";
    }
    value = String(value);
    let text = texts[idx];
    text = text === void 0 || text === null ? value : String(text);
    return toUrlCommaDelimitedString(value, text);
  });
}
function fromUrlValues(urlValues) {
  urlValues = Array.isArray(urlValues) ? urlValues : [urlValues];
  return urlValues.reduce(
    (acc, urlValue) => {
      const [value, label] = (urlValue != null ? urlValue : "").split(",");
      acc.values.push(unescapeUrlDelimiters(value));
      acc.texts.push(unescapeUrlDelimiters(label != null ? label : value));
      return acc;
    },
    {
      values: [],
      texts: []
    }
  );
}

export { GroupByVariableUrlSyncHandler };
//# sourceMappingURL=GroupByVariableUrlSyncHandler.js.map
