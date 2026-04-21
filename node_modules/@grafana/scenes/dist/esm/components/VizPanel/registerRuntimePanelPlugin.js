import { getPluginImportUtils } from '@grafana/runtime';

const runtimePanelPlugins = /* @__PURE__ */ new Map();
function registerRuntimePanelPlugin({ pluginId, plugin }) {
  if (runtimePanelPlugins.has(pluginId)) {
    throw new Error(`A runtime panel plugin with id ${pluginId} has already been registered`);
  }
  plugin.meta = {
    ...plugin.meta,
    id: pluginId,
    name: pluginId,
    module: "runtime plugin",
    baseUrl: "runtime plugin",
    info: {
      author: {
        name: "Runtime plugin " + pluginId
      },
      description: "",
      links: [],
      logos: {
        large: "",
        small: ""
      },
      screenshots: [],
      updated: "",
      version: ""
    }
  };
  runtimePanelPlugins.set(pluginId, plugin);
}
function loadPanelPluginSync(pluginId) {
  var _a;
  const { getPanelPluginFromCache } = getPluginImportUtils();
  return (_a = getPanelPluginFromCache(pluginId)) != null ? _a : runtimePanelPlugins.get(pluginId);
}

export { loadPanelPluginSync, registerRuntimePanelPlugin, runtimePanelPlugins };
//# sourceMappingURL=registerRuntimePanelPlugin.js.map
