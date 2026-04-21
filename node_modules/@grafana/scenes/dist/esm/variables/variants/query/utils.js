import { isNumber, uniqBy, sortBy, toLower } from 'lodash';
import { stringToJsRegex, VariableSort } from '@grafana/data';

function metricNamesToVariableValues({
  variableRegEx,
  variableRegexApplyTo,
  sort,
  metricNames
}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  let regex;
  let options = [];
  if (variableRegEx) {
    regex = stringToJsRegex(variableRegEx);
  }
  for (let i = 0; i < metricNames.length; i++) {
    const item = metricNames[i];
    let text = (_b = (_a = item.text) != null ? _a : item.value) != null ? _b : "";
    let value = (_d = (_c = item.value) != null ? _c : item.text) != null ? _d : "";
    if (isNumber(value)) {
      value = value.toString();
    }
    if (isNumber(text)) {
      text = text.toString();
    }
    if (regex) {
      const applyTo = variableRegexApplyTo === "text" ? text : value;
      const matches = getAllMatches(applyTo, regex);
      if (!matches.length) {
        continue;
      }
      const valueGroup = matches.find((m) => m.groups && m.groups.value);
      const textGroup = matches.find((m) => m.groups && m.groups.text);
      const firstMatch = matches.find((m) => m.length > 1);
      const manyMatches = matches.length > 1 && firstMatch;
      if (valueGroup || textGroup) {
        value = (_g = (_e = valueGroup == null ? void 0 : valueGroup.groups) == null ? void 0 : _e.value) != null ? _g : (_f = textGroup == null ? void 0 : textGroup.groups) == null ? void 0 : _f.text;
        text = (_j = (_h = textGroup == null ? void 0 : textGroup.groups) == null ? void 0 : _h.text) != null ? _j : (_i = valueGroup == null ? void 0 : valueGroup.groups) == null ? void 0 : _i.value;
      } else if (manyMatches) {
        for (let j = 0; j < matches.length; j++) {
          const match = matches[j];
          options.push({ label: match[1], value: match[1] });
        }
        continue;
      } else if (firstMatch) {
        text = firstMatch[1];
        value = firstMatch[1];
      }
    }
    options.push({ label: text, value, properties: item.properties });
  }
  options = uniqBy(options, "value");
  return sortVariableValues(options, sort);
}
const getAllMatches = (str, regex) => {
  const results = [];
  let matches = null;
  regex.lastIndex = 0;
  do {
    matches = regex.exec(str);
    if (matches) {
      results.push(matches);
    }
  } while (regex.global && matches && matches[0] !== "" && matches[0] !== void 0);
  return results;
};
const sortVariableValues = (options, sortOrder) => {
  if (sortOrder === VariableSort.disabled) {
    return options;
  }
  switch (sortOrder) {
    case VariableSort.alphabeticalAsc:
      options = sortBy(options, "label");
      break;
    case VariableSort.alphabeticalDesc:
      options = sortBy(options, "label").reverse();
      break;
    case VariableSort.numericalAsc:
      options = sortBy(options, sortByNumeric);
      break;
    case VariableSort.numericalDesc:
      options = sortBy(options, sortByNumeric);
      options = options.reverse();
      break;
    case VariableSort.alphabeticalCaseInsensitiveAsc:
      options = sortBy(options, (opt) => {
        return toLower(opt.label);
      });
      break;
    case VariableSort.alphabeticalCaseInsensitiveDesc:
      options = sortBy(options, (opt) => {
        return toLower(opt.label);
      });
      options = options.reverse();
      break;
    case VariableSort.naturalAsc:
      options = sortByNaturalSort(options);
      break;
    case VariableSort.naturalDesc:
      options = sortByNaturalSort(options);
      options = options.reverse();
      break;
  }
  return options;
};
function sortByNumeric(opt) {
  if (!opt.label) {
    return -1;
  }
  const matches = opt.label.match(/.*?(\d+).*/);
  if (!matches || matches.length < 2) {
    return -1;
  } else {
    return parseInt(matches[1], 10);
  }
}
const collator = new Intl.Collator(void 0, { sensitivity: "accent", numeric: true });
function sortByNaturalSort(options) {
  return options.slice().sort((a, b) => {
    return collator.compare(a.label, b.label);
  });
}

export { metricNamesToVariableValues, sortVariableValues };
//# sourceMappingURL=utils.js.map
