import React, { createContext } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SceneObjectBase } from '../../core/SceneObjectBase.js';

class SceneApp extends SceneObjectBase {
  constructor() {
    super(...arguments);
    this._renderBeforeActivation = true;
  }
  enrichDataRequest() {
    return {
      app: this.state.name || "app"
    };
  }
}
SceneApp.Component = ({ model }) => {
  const { pages } = model.useState();
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(SceneAppContext.Provider, { value: model }, /* @__PURE__ */ React.createElement(Routes, null, pages.map((page) => /* @__PURE__ */ React.createElement(Route, { key: page.state.url, path: page.state.routePath, element: /* @__PURE__ */ React.createElement(page.Component, { model: page }) })))));
};
const SceneAppContext = createContext(null);
const sceneAppCache = /* @__PURE__ */ new Map();
function useSceneApp(factory) {
  const cachedApp = sceneAppCache.get(factory);
  if (cachedApp) {
    return cachedApp;
  }
  const newApp = factory();
  sceneAppCache.set(factory, newApp);
  return newApp;
}

export { SceneApp, SceneAppContext, useSceneApp };
//# sourceMappingURL=SceneApp.js.map
