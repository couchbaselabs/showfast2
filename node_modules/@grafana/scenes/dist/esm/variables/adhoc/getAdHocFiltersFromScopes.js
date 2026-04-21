import { scopeFilterOperatorMap } from '@grafana/data';

const reverseScopeFilterOperatorMap = Object.fromEntries(
  Object.entries(scopeFilterOperatorMap).map(([symbol, operator]) => [operator, symbol])
);
function isEqualityOrMultiOperator(value) {
  const operators = /* @__PURE__ */ new Set(["equals", "not-equals", "one-of", "not-one-of"]);
  return operators.has(value);
}
function isRegexOperator(value) {
  const operators = /* @__PURE__ */ new Set(["regex-match", "regex-not-match"]);
  return operators.has(value);
}
function getAdHocFiltersFromScopes(scopes) {
  const formattedFilters = /* @__PURE__ */ new Map();
  const duplicatedFilters = [];
  const allFilters = scopes.flatMap((scope) => scope.spec.filters);
  for (const filter of allFilters) {
    processFilter(formattedFilters, duplicatedFilters, filter);
  }
  return [...formattedFilters.values(), ...duplicatedFilters];
}
function processFilter(formattedFilters, duplicatedFilters, filter) {
  var _a, _b;
  if (!filter) {
    return;
  }
  const existingFilter = formattedFilters.get(filter.key);
  if (existingFilter && isEqualityValue(existingFilter.operator, filter.operator)) {
    mergeFilterValues(existingFilter, filter);
  } else if (existingFilter && isRegexValue(existingFilter.operator, filter.operator)) {
    existingFilter.value += `|${filter.value}`;
    existingFilter.values = [existingFilter.value];
  } else if (!existingFilter) {
    formattedFilters.set(filter.key, {
      key: filter.key,
      operator: reverseScopeFilterOperatorMap[filter.operator],
      value: filter.value,
      values: (_a = filter.values) != null ? _a : [filter.value],
      origin: "scope"
    });
  } else {
    duplicatedFilters.push({
      key: filter.key,
      operator: reverseScopeFilterOperatorMap[filter.operator],
      value: filter.value,
      values: (_b = filter.values) != null ? _b : [filter.value],
      origin: "scope"
    });
  }
}
function mergeFilterValues(adHocFilter, filter) {
  var _a, _b, _c, _d;
  const values = (_a = filter.values) != null ? _a : [filter.value];
  for (const value of values) {
    if (!((_b = adHocFilter.values) == null ? void 0 : _b.includes(value))) {
      (_c = adHocFilter.values) == null ? void 0 : _c.push(value);
    }
  }
  if (((_d = adHocFilter.values) == null ? void 0 : _d.length) === 1) {
    return;
  }
  if (filter.operator === "equals" && adHocFilter.operator === reverseScopeFilterOperatorMap["equals"]) {
    adHocFilter.operator = reverseScopeFilterOperatorMap["one-of"];
  } else if (filter.operator === "not-equals" && adHocFilter.operator === reverseScopeFilterOperatorMap["not-equals"]) {
    adHocFilter.operator = reverseScopeFilterOperatorMap["not-one-of"];
  }
}
function isRegexValue(adHocFilterOperator, filterOperator) {
  const scopeConvertedOperator = scopeFilterOperatorMap[adHocFilterOperator];
  if (!isRegexOperator(scopeConvertedOperator) || !isRegexOperator(filterOperator)) {
    return false;
  }
  return hasSameOperators(scopeConvertedOperator, filterOperator);
}
function isEqualityValue(adHocFilterOperator, filterOperator) {
  const scopeConvertedOperator = scopeFilterOperatorMap[adHocFilterOperator];
  if (!isEqualityOrMultiOperator(scopeConvertedOperator) || !isEqualityOrMultiOperator(filterOperator)) {
    return false;
  }
  return hasSameOperators(scopeConvertedOperator, filterOperator);
}
function hasSameOperators(scopeConvertedOperator, filterOperator) {
  if (scopeConvertedOperator.includes("not") && !filterOperator.includes("not") || !scopeConvertedOperator.includes("not") && filterOperator.includes("not")) {
    return false;
  }
  return true;
}

export { getAdHocFiltersFromScopes, isEqualityOrMultiOperator, isRegexOperator, reverseScopeFilterOperatorMap };
//# sourceMappingURL=getAdHocFiltersFromScopes.js.map
