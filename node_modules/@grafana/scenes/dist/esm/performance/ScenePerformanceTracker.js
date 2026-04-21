function generateOperationId(prefix = "op") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    const uuid = crypto.randomUUID();
    return `${prefix}-${uuid}`;
  }
  const randomPart = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return `${prefix}-${randomPart}`;
}
const _ScenePerformanceTracker = class _ScenePerformanceTracker {
  constructor() {
    this.observers = [];
  }
  static getInstance() {
    if (!_ScenePerformanceTracker.instance) {
      _ScenePerformanceTracker.instance = new _ScenePerformanceTracker();
    }
    return _ScenePerformanceTracker.instance;
  }
  /**
   * Register a performance observer
   */
  addObserver(observer) {
    this.observers.push(observer);
    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }
  /**
   * Remove all observers (for testing)
   */
  clearObservers() {
    this.observers = [];
  }
  /**
   * Get current observer count (for debugging)
   */
  getObserverCount() {
    return this.observers.length;
  }
  notifyObservers(methodName, data, errorContext) {
    this.observers.forEach((observer) => {
      try {
        const method = observer[methodName];
        method == null ? void 0 : method(data);
      } catch (error) {
        console.warn(`Error in ${errorContext} observer:`, error);
      }
    });
  }
  notifyDashboardInteractionStart(data) {
    this.notifyObservers("onDashboardInteractionStart", data, "dashboard interaction start");
  }
  notifyDashboardInteractionMilestone(data) {
    this.notifyObservers("onDashboardInteractionMilestone", data, "dashboard interaction milestone");
  }
  notifyDashboardInteractionComplete(data) {
    this.notifyObservers("onDashboardInteractionComplete", data, "dashboard interaction complete");
  }
  notifyPanelOperationStart(data) {
    this.notifyObservers("onPanelOperationStart", data, "panel operation start");
  }
  notifyPanelOperationComplete(data) {
    this.notifyObservers("onPanelOperationComplete", data, "panel operation complete");
  }
  notifyQueryStart(data) {
    this.notifyObservers("onQueryStart", data, "query start");
  }
  notifyQueryComplete(data) {
    this.notifyObservers("onQueryComplete", data, "query complete");
  }
};
_ScenePerformanceTracker.instance = null;
let ScenePerformanceTracker = _ScenePerformanceTracker;
function getScenePerformanceTracker() {
  return ScenePerformanceTracker.getInstance();
}

export { ScenePerformanceTracker, generateOperationId, getScenePerformanceTracker };
//# sourceMappingURL=ScenePerformanceTracker.js.map
