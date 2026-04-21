function isAdHocVariable(variable) {
  return variable.state.type === "adhoc";
}
function isConstantVariable(variable) {
  return variable.state.type === "constant";
}
function isCustomVariable(variable) {
  return variable.state.type === "custom";
}
function isDataSourceVariable(variable) {
  return variable.state.type === "datasource";
}
function isIntervalVariable(variable) {
  return variable.state.type === "interval";
}
function isQueryVariable(variable) {
  return variable.state.type === "query";
}
function isTextBoxVariable(variable) {
  return variable.state.type === "textbox";
}
function isGroupByVariable(variable) {
  return variable.state.type === "groupby";
}
function isSwitchVariable(variable) {
  return variable.state.type === "switch";
}

export { isAdHocVariable, isConstantVariable, isCustomVariable, isDataSourceVariable, isGroupByVariable, isIntervalVariable, isQueryVariable, isSwitchVariable, isTextBoxVariable };
//# sourceMappingURL=guards.js.map
