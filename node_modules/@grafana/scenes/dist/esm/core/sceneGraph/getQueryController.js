import { isQueryController } from '../../behaviors/SceneQueryController.js';

function getQueryController(sceneObject) {
  let parent = sceneObject;
  while (parent) {
    if (parent.state.$behaviors) {
      for (const behavior of parent.state.$behaviors) {
        if (isQueryController(behavior)) {
          return behavior;
        }
      }
    }
    parent = parent.parent;
  }
  return void 0;
}

export { getQueryController };
//# sourceMappingURL=getQueryController.js.map
