import React, { useState, useEffect } from 'react';

function SceneComponentWrapperWithoutMemo({ model, ...otherProps }) {
  var _a;
  const Component = (_a = model.constructor["Component"]) != null ? _a : EmptyRenderer;
  const [_, setValue] = useState(0);
  useEffect(() => {
    const unsub = model.activate();
    setValue((prevState) => prevState + 1);
    return unsub;
  }, [model]);
  if (!model.isActive && !model.renderBeforeActivation) {
    return null;
  }
  return /* @__PURE__ */ React.createElement(Component, { ...otherProps, model });
}
const SceneComponentWrapper = React.memo(SceneComponentWrapperWithoutMemo);
function EmptyRenderer(_) {
  return null;
}

export { SceneComponentWrapper };
//# sourceMappingURL=SceneComponentWrapper.js.map
