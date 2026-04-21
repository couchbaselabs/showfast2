import { VizPanel } from '../components/VizPanel/VizPanel.js';
import { VizPanelRenderProfiler } from './VizPanelRenderProfiler.js';
import { sceneGraph } from '../core/sceneGraph/index.js';

class PanelProfilingManager {
  constructor(_config) {
    this._config = _config;
    this._subscriptions = [];
  }
  /**
   * Attach panel profiling to a scene object
   */
  attachToScene(sceneObject) {
    this._sceneObject = sceneObject;
    const subscription = sceneObject.subscribeToState((newState, prevState) => {
      if (this._config.watchStateKey) {
        if (newState[this._config.watchStateKey] !== prevState[this._config.watchStateKey]) {
          this._attachProfilersToPanels();
        }
      } else {
        this._attachProfilersToPanels();
      }
    });
    this._subscriptions.push(subscription);
    this._attachProfilersToPanels();
  }
  /**
   * Attach VizPanelRenderProfiler to a specific panel if it doesn't already have one
   * @param panel - The VizPanel to attach profiling to
   */
  attachProfilerToPanel(panel) {
    var _a;
    const existingProfiler = (_a = panel.state.$behaviors) == null ? void 0 : _a.find((b) => b instanceof VizPanelRenderProfiler);
    if (existingProfiler) {
      return;
    }
    const profiler = new VizPanelRenderProfiler();
    panel.setState({
      $behaviors: [...panel.state.$behaviors || [], profiler]
    });
  }
  /**
   * Attach VizPanelRenderProfiler to all VizPanels that don't already have one
   */
  _attachProfilersToPanels() {
    if (!this._sceneObject) {
      return;
    }
    const panels = sceneGraph.findAllObjects(this._sceneObject, (obj) => obj instanceof VizPanel);
    panels.forEach((panel) => {
      this.attachProfilerToPanel(panel);
    });
  }
  /**
   * Clean up subscriptions and references
   */
  cleanup() {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
    this._subscriptions = [];
    this._sceneObject = void 0;
  }
}

export { PanelProfilingManager };
//# sourceMappingURL=PanelProfilingManager.js.map
