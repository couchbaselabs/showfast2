function getClosest(sceneObject, extract) {
  let curSceneObject = sceneObject;
  let extracted = void 0;
  while (curSceneObject && !extracted) {
    extracted = extract(curSceneObject);
    curSceneObject = curSceneObject.parent;
  }
  return extracted;
}

export { getClosest };
//# sourceMappingURL=utils.js.map
