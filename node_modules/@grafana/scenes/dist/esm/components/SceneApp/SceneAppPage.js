import { t, Trans } from '@grafana/i18n';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { SceneObjectBase } from '../../core/SceneObjectBase.js';
import { isDataRequestEnricher } from '../../core/types.js';
import { EmbeddedScene } from '../EmbeddedScene.js';
import { SceneFlexLayout, SceneFlexItem } from '../layout/SceneFlexLayout.js';
import { SceneReactObject } from '../SceneReactObject.js';
import { SceneAppDrilldownViewRender, SceneAppPageView } from './SceneAppPageView.js';

class SceneAppPage extends SceneObjectBase {
  constructor() {
    super(...arguments);
    this._sceneCache = /* @__PURE__ */ new Map();
    this._drilldownCache = /* @__PURE__ */ new Map();
  }
  initializeScene(scene) {
    this.setState({ initializedScene: scene });
  }
  getScene(routeMatch) {
    let scene = this._sceneCache.get(routeMatch.url);
    if (scene) {
      return scene;
    }
    if (!this.state.getScene) {
      throw new Error("Missing getScene on SceneAppPage " + this.state.title);
    }
    scene = this.state.getScene(routeMatch);
    this._sceneCache.set(routeMatch.url, scene);
    return scene;
  }
  getDrilldownPage(drilldown, routeMatch) {
    let page = this._drilldownCache.get(routeMatch.url);
    if (page) {
      return page;
    }
    page = drilldown.getPage(routeMatch, this);
    this._drilldownCache.set(routeMatch.url, page);
    return page;
  }
  enrichDataRequest(source) {
    if (this.state.getParentPage) {
      return this.state.getParentPage().enrichDataRequest(source);
    }
    if (!this.parent) {
      return null;
    }
    const root = this.getRoot();
    if (isDataRequestEnricher(root)) {
      return root.enrichDataRequest(source);
    }
    return null;
  }
}
SceneAppPage.Component = SceneAppPageRenderer;
function SceneAppPageRenderer({ model }) {
  const { tabs, drilldowns } = model.useState();
  const routes = [];
  routes.push(getFallbackRoute(model));
  if (tabs && tabs.length > 0) {
    for (let tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
      const tab = tabs[tabIndex];
      if (tabIndex === 0) {
        routes.push(/* @__PURE__ */ React.createElement(Route, { key: model.state.routePath, path: "", element: /* @__PURE__ */ React.createElement(tab.Component, { model: tab }) }));
      }
      routes.push(
        /* @__PURE__ */ React.createElement(Route, { key: tab.state.url, path: tab.state.routePath, element: /* @__PURE__ */ React.createElement(tab.Component, { model: tab }) })
      );
      if (tab.state.drilldowns) {
        for (const drilldown of tab.state.drilldowns) {
          routes.push(
            /* @__PURE__ */ React.createElement(
              Route,
              {
                key: drilldown.routePath,
                path: drilldown.routePath,
                element: /* @__PURE__ */ React.createElement(SceneAppDrilldownViewRender, { drilldown, parent: tab })
              }
            )
          );
        }
      }
    }
  }
  if (drilldowns) {
    for (const drilldown of drilldowns) {
      routes.push(
        /* @__PURE__ */ React.createElement(
          Route,
          {
            key: drilldown.routePath,
            path: drilldown.routePath,
            Component: () => /* @__PURE__ */ React.createElement(SceneAppDrilldownViewRender, { drilldown, parent: model })
          }
        )
      );
    }
  }
  if (!tabs) {
    routes.push(/* @__PURE__ */ React.createElement(Route, { key: "home route", path: "/", element: /* @__PURE__ */ React.createElement(SceneAppPageView, { page: model }) }));
  }
  return /* @__PURE__ */ React.createElement(Routes, null, routes);
}
function getFallbackRoute(page) {
  var _a, _b, _c;
  return /* @__PURE__ */ React.createElement(
    Route,
    {
      key: "fallback route",
      path: "*",
      element: /* @__PURE__ */ React.createElement(SceneAppPageView, { page: (_c = (_b = (_a = page.state).getFallbackPage) == null ? void 0 : _b.call(_a)) != null ? _c : getDefaultFallbackPage() })
    }
  );
}
function getDefaultFallbackPage() {
  return new SceneAppPage({
    url: "",
    title: t("grafana-scenes.components.fallback-page.title", "Not found"),
    subTitle: t("grafana-scenes.components.fallback-page.subTitle", "The url did not match any page"),
    routePath: "*",
    getScene: () => {
      return new EmbeddedScene({
        body: new SceneFlexLayout({
          direction: "column",
          children: [
            new SceneFlexItem({
              body: new SceneReactObject({
                component: () => {
                  return /* @__PURE__ */ React.createElement("div", { "data-testid": "default-fallback-content" }, /* @__PURE__ */ React.createElement(Trans, { i18nKey: "grafana-scenes.components.fallback-page.content" }, "If you found your way here using a link then there might be a bug in this application."));
                }
              })
            })
          ]
        })
      });
    }
  });
}

export { SceneAppPage };
//# sourceMappingURL=SceneAppPage.js.map
