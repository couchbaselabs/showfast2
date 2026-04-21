import { cloneDeep, merge } from 'lodash';

class PanelOptionsBuilder {
  constructor(defaultOptions) {
    this.defaultOptions = defaultOptions;
    this._options = {};
    this.setDefaults();
  }
  setDefaults() {
    this._options = this.defaultOptions ? cloneDeep(this.defaultOptions()) : {};
  }
  /**
   * Set an individual panel option. This will merge the value with the existing options.
   */
  setOption(id, value) {
    this._options = merge(this._options, { [id]: value });
    return this;
  }
  build() {
    return this._options;
  }
}

export { PanelOptionsBuilder };
//# sourceMappingURL=PanelOptionsBuilder.js.map
