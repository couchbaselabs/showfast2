const GLOBAL_ANNOTATION_ID = 0;
function filterAnnotations(data, filters) {
  var _a;
  if (!Array.isArray(data) || data.length === 0) {
    return data;
  }
  const rows = Array.from({ length: data.length }, () => /* @__PURE__ */ new Set());
  let frameIdx = 0;
  for (const frame of data) {
    for (let index = 0; index < frame.length; index++) {
      if (rows[frameIdx].has(index)) {
        continue;
      }
      let matching = true;
      const panelIdField = frame.fields.find((f) => f.name === "panelId");
      const sourceField = frame.fields.find((f) => f.name === "source");
      if (sourceField) {
        if (panelIdField && sourceField.values[index].type === "dashboard") {
          matching = [filters.panelId, GLOBAL_ANNOTATION_ID].includes(panelIdField.values[index]);
        }
        const sourceFilter = sourceField.values[index].filter;
        if (sourceFilter) {
          const includes = [...(_a = sourceFilter.ids) != null ? _a : [], GLOBAL_ANNOTATION_ID].includes(filters.panelId);
          if (sourceFilter.exclude) {
            if (includes) {
              matching = false;
            }
          } else if (!includes) {
            matching = false;
          }
        }
      }
      if (matching) {
        rows[frameIdx].add(index);
      }
    }
    frameIdx++;
  }
  const processed = [];
  frameIdx = 0;
  for (const frame of data) {
    const frameLength = rows[frameIdx].size;
    const fields = [];
    for (const field of frame.fields) {
      const buffer = [];
      for (let index = 0; index < frame.length; index++) {
        if (rows[frameIdx].has(index)) {
          buffer.push(field.values[index]);
          continue;
        }
      }
      fields.push({
        ...field,
        values: buffer
      });
    }
    processed.push({
      ...frame,
      fields,
      length: frameLength
    });
    frameIdx++;
  }
  return processed;
}

export { filterAnnotations };
//# sourceMappingURL=filterAnnotations.js.map
