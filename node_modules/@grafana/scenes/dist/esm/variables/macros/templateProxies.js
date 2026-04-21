import { getFieldDisplayName, formatLabels } from '@grafana/data';

function getTemplateProxyForField(field, frame, frames) {
  return new Proxy(
    {},
    // This object shows up in test snapshots
    {
      get: (obj, key) => {
        if (key === "name") {
          return field.name;
        }
        if (key === "displayName") {
          return getFieldDisplayName(field, frame, frames);
        }
        if (key === "labels" || key === "formattedLabels") {
          if (!field.labels) {
            return "";
          }
          return {
            ...field.labels,
            __values: Object.values(field.labels).sort().join(", "),
            toString: () => {
              return formatLabels(field.labels, "", true);
            }
          };
        }
        return void 0;
      }
    }
  );
}

export { getTemplateProxyForField };
//# sourceMappingURL=templateProxies.js.map
