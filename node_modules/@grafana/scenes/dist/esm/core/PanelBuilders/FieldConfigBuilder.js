import { cloneDeep, merge } from 'lodash';
import { FieldConfigOverridesBuilder } from './FieldConfigOverridesBuilder.js';

class FieldConfigBuilder {
  constructor(defaultFieldConfig) {
    this.defaultFieldConfig = defaultFieldConfig;
    this._fieldConfig = {
      defaults: {},
      overrides: []
    };
    this._overridesBuilder = new FieldConfigOverridesBuilder();
    this.setDefaults();
  }
  setDefaults() {
    const fieldConfig = {
      defaults: {
        custom: this.defaultFieldConfig ? cloneDeep(this.defaultFieldConfig()) : {}
      },
      // use field config factory that will provide default field config
      overrides: []
    };
    this._fieldConfig = fieldConfig;
  }
  /**
   * Set color.
   */
  setColor(color) {
    return this.setFieldConfigDefaults("color", color);
  }
  /**
   * Set number of decimals to show.
   */
  setDecimals(decimals) {
    return this.setFieldConfigDefaults("decimals", decimals);
  }
  /**
   * Set field display name.
   */
  setDisplayName(displayName) {
    return this.setFieldConfigDefaults("displayName", displayName);
  }
  /**
   * Set the standard field config property filterable.
   */
  setFilterable(filterable) {
    return this.setFieldConfigDefaults("filterable", filterable);
  }
  /**
   * Set data links.
   */
  setLinks(links) {
    return this.setFieldConfigDefaults("links", links);
  }
  /**
   * Set value mappings.
   */
  setMappings(mappings) {
    return this.setFieldConfigDefaults("mappings", mappings);
  }
  /**
   * Set the standard field config property max.
   */
  setMax(max) {
    return this.setFieldConfigDefaults("max", max);
  }
  /**
   * Set the standard field config property min.
   */
  setMin(min) {
    return this.setFieldConfigDefaults("min", min);
  }
  /**
   * Set the standard field config property noValue.
   */
  setNoValue(noValue) {
    return this.setFieldConfigDefaults("noValue", noValue);
  }
  /**
   * Set the standard field config property thresholds.
   */
  setThresholds(thresholds) {
    return this.setFieldConfigDefaults("thresholds", thresholds);
  }
  /**
   * Set the standard field config property unit.
   */
  setUnit(unit) {
    return this.setFieldConfigDefaults("unit", unit);
  }
  /**
   * Set an individual custom field config value. This will merge the value with the existing custom field config.
   */
  setCustomFieldConfig(id, value) {
    this._fieldConfig.defaults = {
      ...this._fieldConfig.defaults,
      custom: merge(this._fieldConfig.defaults.custom, { [id]: value })
    };
    return this;
  }
  /**
   * Configure overrides for the field config. This will merge the overrides with the existing overrides.
   */
  setOverrides(builder) {
    builder(this._overridesBuilder);
    return this;
  }
  setFieldConfigDefaults(key, value) {
    this._fieldConfig.defaults = {
      ...this._fieldConfig.defaults,
      [key]: value
    };
    return this;
  }
  build() {
    return {
      defaults: this._fieldConfig.defaults,
      overrides: this._overridesBuilder.build()
    };
  }
}

export { FieldConfigBuilder };
//# sourceMappingURL=FieldConfigBuilder.js.map
