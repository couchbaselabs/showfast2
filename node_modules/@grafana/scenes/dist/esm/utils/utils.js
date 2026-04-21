import { useLocationService, locationService } from '@grafana/runtime';

function setBaseClassState(sceneObject, newState) {
  sceneObject.setState(newState);
}
function useLocationServiceSafe() {
  return useLocationService ? useLocationService() : locationService;
}
function isRepeatCloneOrChildOf(scene) {
  let obj = scene;
  do {
    if ("repeatSourceKey" in obj.state && obj.state.repeatSourceKey) {
      return true;
    }
    obj = obj.parent;
  } while (obj);
  return false;
}

export { isRepeatCloneOrChildOf, setBaseClassState, useLocationServiceSafe };
//# sourceMappingURL=utils.js.map
