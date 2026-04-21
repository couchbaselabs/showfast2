import { VizPanel } from '../../components/VizPanel/VizPanel.js';
import { FieldConfigBuilder } from './FieldConfigBuilder.js';
import { PanelOptionsBuilder } from './PanelOptionsBuilder.js';

class VizPanelBuilder {
  constructor(pluginId, pluginVersion, defaultOptions, defaultFieldConfig) {
    this._state = {};
    this._state.title = "";
    this._state.description = "";
    this._state.displayMode = "default";
    this._state.hoverHeader = false;
    this._state.pluginId = pluginId;
    this._state.pluginVersion = pluginVersion;
    this._fieldConfigBuilder = new FieldConfigBuilder(defaultFieldConfig);
    this._panelOptionsBuilder = new PanelOptionsBuilder(defaultOptions);
  }
  /**
   * Set panel title.
   */
  setTitle(title) {
    this._state.title = title;
    return this;
  }
  /**
   * Set panel description.
   */
  setDescription(description) {
    this._state.description = description;
    return this;
  }
  /**
   * Set panel display mode.
   */
  setDisplayMode(displayMode) {
    this._state.displayMode = displayMode;
    return this;
  }
  /**
   * Set if panel header should be shown on hover.
   */
  setHoverHeader(hoverHeader) {
    this._state.hoverHeader = hoverHeader;
    return this;
  }
  /**
   * Set if VizPanelMenu "kebab" icon is shown on panel hover for desktop devices. Set true to always show menu icon.
   * @param showMenuAlways
   */
  setShowMenuAlways(showMenuAlways) {
    this._state.showMenuAlways = showMenuAlways;
    return this;
  }
  /**
   * Set panel menu scene object.
   */
  setMenu(menu) {
    this._state.menu = menu;
    return this;
  }
  /**
   * Set scene object or react component to use as panel header actions.
   */
  setHeaderActions(headerActions) {
    this._state.headerActions = headerActions;
    return this;
  }
  setCollapsible(collapsible) {
    this._state.collapsible = collapsible;
    return this;
  }
  setCollapsed(collapsed) {
    this._state.collapsed = collapsed;
    return this;
  }
  /**
   * Set color.
   */
  setColor(color) {
    this._fieldConfigBuilder.setColor(color);
    return this;
  }
  /**
   * Set number of decimals to show.
   */
  setDecimals(decimals) {
    this._fieldConfigBuilder.setDecimals(decimals);
    return this;
  }
  /**
   * Set field display name.
   */
  setDisplayName(displayName) {
    this._fieldConfigBuilder.setDisplayName(displayName);
    return this;
  }
  /**
   * Set the standard field config property filterable.
   */
  setFilterable(filterable) {
    this._fieldConfigBuilder.setFilterable(filterable);
    return this;
  }
  /**
   * Set data links.
   */
  setLinks(links) {
    this._fieldConfigBuilder.setLinks(links);
    return this;
  }
  /**
   * Set value mappings.
   */
  setMappings(mappings) {
    this._fieldConfigBuilder.setMappings(mappings);
    return this;
  }
  /**
   * Set the standard field config property max.
   */
  setMax(max) {
    this._fieldConfigBuilder.setMax(max);
    return this;
  }
  /**
   * Set the standard field config property min.
   */
  setMin(min) {
    this._fieldConfigBuilder.setMin(min);
    return this;
  }
  /**
   * Set the standard field config property noValue.
   */
  setNoValue(noValue) {
    this._fieldConfigBuilder.setNoValue(noValue);
    return this;
  }
  /**
   * Set the standard field config property thresholds.
   */
  setThresholds(thresholds) {
    this._fieldConfigBuilder.setThresholds(thresholds);
    return this;
  }
  /**
   * Set the standard field config property unit.
   */
  setUnit(unit) {
    this._fieldConfigBuilder.setUnit(unit);
    return this;
  }
  setCustomFieldConfig(id, value) {
    this._fieldConfigBuilder.setCustomFieldConfig(id, value);
    return this;
  }
  setOverrides(builder) {
    this._fieldConfigBuilder.setOverrides(builder);
    return this;
  }
  /**
   * Set an individual panel option. This will merge the value with the existing options.
   */
  setOption(id, value) {
    this._panelOptionsBuilder.setOption(id, value);
    return this;
  }
  /**
   * Set data provider for the panel.
   */
  setData(data) {
    this._state.$data = data;
    return this;
  }
  /**
   * Set time range for the panel.
   */
  setTimeRange(timeRange) {
    this._state.$timeRange = timeRange;
    return this;
  }
  /**
   * Set variables for the panel.
   */
  setVariables(variables) {
    this._state.$variables = variables;
    return this;
  }
  /**
   * Set behaviors for the panel.
   */
  setBehaviors(behaviors) {
    this._state.$behaviors = behaviors;
    return this;
  }
  /**
   * Sets the default series limit for the panel.
   */
  setSeriesLimit(seriesLimit) {
    this._state.seriesLimit = seriesLimit;
    return this;
  }
  /**
   * Makes it possible to shared config between different builders
   */
  applyMixin(mixin) {
    mixin(this);
    return this;
  }
  /**
   * Build the panel.
   */
  build() {
    const panel = new VizPanel({
      ...this._state,
      options: this._panelOptionsBuilder.build(),
      fieldConfig: this._fieldConfigBuilder.build()
    });
    return panel;
  }
}

export { VizPanelBuilder };
//# sourceMappingURL=VizPanelBuilder.js.map
