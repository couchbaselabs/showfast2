import { sceneGraph } from '../core/sceneGraph/index.js';
import { VizPanel } from '../components/VizPanel/VizPanel.js';
import { VizPanelRenderProfiler } from '../performance/VizPanelRenderProfiler.js';

function findPanelProfiler(sceneObject) {
  try {
    const panel = sceneGraph.getAncestor(sceneObject, VizPanel);
    if (panel) {
      const behaviors = panel.state.$behaviors || [];
      return behaviors.find((b) => b instanceof VizPanelRenderProfiler);
    }
  } catch (error) {
  }
  return void 0;
}

export { findPanelProfiler };
//# sourceMappingURL=findPanelProfiler.js.map
