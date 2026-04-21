import { fuzzyFind } from '../filter.js';

function getAdhocOptionSearcher(options) {
  const haystack = options.map((o) => {
    var _a;
    return (_a = o.label) != null ? _a : String(o.value);
  });
  return (search) => fuzzyFind(options, haystack, search);
}

export { getAdhocOptionSearcher };
//# sourceMappingURL=getAdhocOptionSearcher.js.map
