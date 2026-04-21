import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../constants.js';
import { fuzzyFind } from '../filter.js';

function getOptionSearcher(options, includeAll = false) {
  let allOptions = options;
  if (includeAll) {
    allOptions = [{ value: ALL_VARIABLE_VALUE, label: ALL_VARIABLE_TEXT }, ...allOptions];
  }
  const haystack = allOptions.map((o) => o.label);
  return (search) => fuzzyFind(allOptions, haystack, search);
}

export { getOptionSearcher };
//# sourceMappingURL=getOptionSearcher.js.map
