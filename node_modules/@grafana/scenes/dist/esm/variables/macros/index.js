import { DataLinkBuiltInVars } from '@grafana/data';
import { UrlTimeRangeMacro, TimeFromAndToMacro, TimezoneMacro, IntervalMacro } from './timeMacros.js';
import { AllVariablesMacro } from './AllVariablesMacro.js';
import { ValueMacro, DataMacro, SeriesMacro, FieldMacro } from './dataMacros.js';
import { UrlMacro } from './urlMacros.js';
import { UserMacro, OrgMacro } from './contextMacros.js';

const macrosIndex = /* @__PURE__ */ new Map([
  [DataLinkBuiltInVars.includeVars, AllVariablesMacro],
  [DataLinkBuiltInVars.keepTime, UrlTimeRangeMacro],
  ["__value", ValueMacro],
  ["__data", DataMacro],
  ["__series", SeriesMacro],
  ["__field", FieldMacro],
  ["__url", UrlMacro],
  ["__from", TimeFromAndToMacro],
  ["__to", TimeFromAndToMacro],
  ["__timezone", TimezoneMacro],
  ["__user", UserMacro],
  ["__org", OrgMacro],
  ["__interval", IntervalMacro],
  ["__interval_ms", IntervalMacro]
]);
function registerVariableMacro(name, macro, replace = false) {
  if (!replace && macrosIndex.get(name)) {
    throw new Error(`Macro already registered ${name}`);
  }
  macrosIndex.set(name, macro);
  return () => {
    if (replace) {
      throw new Error(`Replaced macros can not be unregistered. They need to be restored manually.`);
    } else {
      macrosIndex.delete(name);
    }
  };
}

export { macrosIndex, registerVariableMacro };
//# sourceMappingURL=index.js.map
