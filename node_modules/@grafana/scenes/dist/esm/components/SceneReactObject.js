import React from 'react';
import { SceneObjectBase } from '../core/SceneObjectBase.js';

class SceneReactObject extends SceneObjectBase {
}
SceneReactObject.Component = ({ model }) => {
  const { component: Component, props, reactNode } = model.useState();
  if (Component) {
    return /* @__PURE__ */ React.createElement(Component, { ...props });
  }
  if (reactNode) {
    return reactNode;
  }
  return null;
};

export { SceneReactObject };
//# sourceMappingURL=SceneReactObject.js.map
