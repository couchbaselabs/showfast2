import { LocalValueVariable } from '../variables/variants/LocalValueVariable.js';

const PATH_ID_SEPARATOR = "$";
function buildPathIdFor(panel) {
  let pathId = `panel-${panel.getLegacyPanelId()}`;
  let lastName;
  let currentObj = panel;
  while (currentObj) {
    const variables = currentObj.state.$variables;
    if (variables) {
      variables.state.variables.forEach((variable) => {
        if (variable.state.name === lastName) {
          return;
        }
        if (variable instanceof LocalValueVariable) {
          pathId = `${variable.state.value}${PATH_ID_SEPARATOR}${pathId}`;
          lastName = variable.state.name;
        }
      });
    }
    currentObj = currentObj.parent;
  }
  return pathId;
}

export { PATH_ID_SEPARATOR, buildPathIdFor };
//# sourceMappingURL=pathId.js.map
