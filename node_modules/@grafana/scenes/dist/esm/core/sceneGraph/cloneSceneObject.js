import { SceneObjectBase } from '../SceneObjectBase.js';
import { SceneObjectRef } from '../SceneObjectRef.js';
import { cloneDeep } from 'lodash';

function cloneSceneObject(sceneObject, withState) {
  const clonedState = cloneSceneObjectState(sceneObject.state, withState);
  return new sceneObject.constructor(clonedState);
}
function cloneSceneObjectState(sceneState, withState) {
  const clonedState = { ...sceneState };
  Object.assign(clonedState, withState);
  for (const key in clonedState) {
    if (withState && withState[key] !== void 0) {
      continue;
    }
    const propValue = clonedState[key];
    if (propValue instanceof SceneObjectRef) {
      console.warn("Cloning object with SceneObjectRef");
      continue;
    }
    if (propValue instanceof SceneObjectBase) {
      clonedState[key] = propValue.clone();
    } else if (Array.isArray(propValue)) {
      const newArray = [];
      for (const child of propValue) {
        if (child instanceof SceneObjectBase) {
          newArray.push(child.clone());
        } else if (typeof child === "object") {
          newArray.push(cloneDeep(child));
        } else {
          newArray.push(child);
        }
      }
      clonedState[key] = newArray;
    } else if (typeof propValue === "object") {
      clonedState[key] = cloneDeep(propValue);
    } else {
      clonedState[key] = propValue;
    }
  }
  return clonedState;
}

export { cloneSceneObject, cloneSceneObjectState };
//# sourceMappingURL=cloneSceneObject.js.map
