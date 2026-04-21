import { isInteractionTracker } from '../../behaviors/SceneInteractionTracker.js';

function getInteractionTracker(sceneObject) {
  let parent = sceneObject;
  while (parent) {
    if (parent.state.$behaviors) {
      for (const behavior of parent.state.$behaviors) {
        if (isInteractionTracker(behavior)) {
          return behavior;
        }
      }
    }
    parent = parent.parent;
  }
  return void 0;
}

export { getInteractionTracker };
//# sourceMappingURL=getInteractionTracker.js.map
