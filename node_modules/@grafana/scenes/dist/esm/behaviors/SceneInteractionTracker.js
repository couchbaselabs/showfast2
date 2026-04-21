import { SceneObjectBase } from '../core/SceneObjectBase.js';

function isInteractionTracker(s) {
  return "isInteractionTracker" in s;
}
class SceneInteractionTracker extends SceneObjectBase {
  constructor(state = {}, renderProfiler) {
    super(state);
    this.renderProfiler = renderProfiler;
    this.isInteractionTracker = true;
    if (renderProfiler) {
      this.renderProfiler = renderProfiler;
      this.renderProfiler.setInteractionCompleteHandler(state.onInteractionComplete);
    }
  }
  startInteraction(name) {
    var _a;
    if (!this.state.enableInteractionTracking) {
      return;
    }
    (_a = this.renderProfiler) == null ? void 0 : _a.startInteraction(name);
  }
  stopInteraction() {
    var _a;
    (_a = this.renderProfiler) == null ? void 0 : _a.stopInteraction();
  }
}

export { SceneInteractionTracker, isInteractionTracker };
//# sourceMappingURL=SceneInteractionTracker.js.map
