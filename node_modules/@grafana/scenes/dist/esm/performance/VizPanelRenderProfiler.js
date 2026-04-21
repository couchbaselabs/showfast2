import { SceneObjectBase } from '../core/SceneObjectBase.js';
import { VizPanel } from '../components/VizPanel/VizPanel.js';
import { writeSceneLog } from '../utils/writeSceneLog.js';
import { sceneGraph } from '../core/sceneGraph/index.js';
import { generateOperationId, getScenePerformanceTracker } from './ScenePerformanceTracker.js';

class VizPanelRenderProfiler extends SceneObjectBase {
  constructor(state = {}) {
    super({
      ...state
    });
    this._isTracking = false;
    this._activeQueries = /* @__PURE__ */ new Map();
    this.addActivationHandler(() => {
      return this._onActivate();
    });
  }
  _onActivate() {
    var _a, _b;
    let panel;
    try {
      panel = sceneGraph.getAncestor(this, VizPanel);
    } catch (error) {
      writeSceneLog("VizPanelRenderProfiler", "Failed to find VizPanel ancestor", error);
      return;
    }
    if (!panel) {
      writeSceneLog("VizPanelRenderProfiler", "Not attached to a VizPanel");
      return;
    }
    if (!panel.state.key) {
      writeSceneLog("VizPanelRenderProfiler", "Panel has no key, skipping tracking");
      return;
    }
    this._panelKey = panel.state.key;
    this._panelId = String(panel.getLegacyPanelId());
    this._pluginId = panel.state.pluginId;
    const plugin = panel.getPlugin();
    this._pluginVersion = (_b = (_a = plugin == null ? void 0 : plugin.meta) == null ? void 0 : _a.info) == null ? void 0 : _b.version;
    this._subs.add(
      panel.subscribeToState((newState, prevState) => {
        this._handlePanelStateChange(panel, newState, prevState);
      })
    );
    return () => {
      this._cleanup();
    };
  }
  _handlePanelStateChange(panel, newState, prevState) {
    if (newState.pluginId !== prevState.pluginId) {
      this._onPluginChange(panel, newState.pluginId);
    }
  }
  /**
   * Track query execution with operation ID correlation
   */
  onQueryStarted(timestamp, entry, queryId) {
    if (!this._panelKey) {
      return null;
    }
    this._activeQueries.set(queryId, { entry, startTime: timestamp });
    const operationId = generateOperationId("query");
    getScenePerformanceTracker().notifyPanelOperationStart({
      operationId,
      panelId: this._panelId,
      panelKey: this._panelKey,
      pluginId: this._pluginId,
      pluginVersion: this._pluginVersion,
      operation: "query",
      timestamp,
      metadata: {
        queryId,
        queryType: entry.type
      }
    });
    return (endTimestamp, error) => {
      if (!this._panelKey) {
        return;
      }
      const queryInfo = this._activeQueries.get(queryId);
      if (!queryInfo) {
        return;
      }
      const duration = endTimestamp - queryInfo.startTime;
      this._activeQueries.delete(queryId);
      getScenePerformanceTracker().notifyPanelOperationComplete({
        operationId,
        panelId: this._panelId,
        panelKey: this._panelKey,
        pluginId: this._pluginId,
        pluginVersion: this._pluginVersion,
        operation: "query",
        timestamp: endTimestamp,
        duration,
        metadata: {
          queryId,
          queryType: entry.type
        },
        error: error ? (error == null ? void 0 : error.message) || String(error) || "Unknown error" : void 0
      });
    };
  }
  /**
   * Track plugin loading with operation ID correlation
   */
  onPluginLoadStart(pluginId) {
    if (!this._panelKey) {
      let panel;
      try {
        panel = sceneGraph.getAncestor(this, VizPanel);
      } catch (error) {
        return null;
      }
      if (panel && !this._panelKey && panel.state.key) {
        this._panelKey = panel.state.key;
        this._panelId = String(panel.getLegacyPanelId());
        this._pluginId = pluginId;
      }
    }
    if (!this._panelKey) {
      return null;
    }
    if (!this._isTracking) {
      this._startTracking();
    }
    this._loadPluginStartTime = performance.now();
    const operationId = generateOperationId("pluginLoad");
    getScenePerformanceTracker().notifyPanelOperationStart({
      operationId,
      panelId: this._panelId,
      panelKey: this._panelKey,
      pluginId: this._pluginId,
      operation: "plugin-load",
      timestamp: this._loadPluginStartTime,
      metadata: {
        pluginId
      }
    });
    return (plugin, fromCache = false) => {
      if (!this._panelKey || !this._loadPluginStartTime) {
        return;
      }
      const duration = performance.now() - this._loadPluginStartTime;
      getScenePerformanceTracker().notifyPanelOperationComplete({
        operationId,
        panelId: this._panelId,
        panelKey: this._panelKey,
        pluginId: this._pluginId,
        operation: "plugin-load",
        timestamp: performance.now(),
        duration,
        metadata: {
          pluginId: this._pluginId,
          fromCache,
          pluginLoadTime: duration
        }
      });
      this._loadPluginStartTime = void 0;
    };
  }
  /**
   * Track field config processing with operation ID correlation
   */
  onFieldConfigStart(timestamp) {
    if (!this._panelKey) {
      return null;
    }
    this._applyFieldConfigStartTime = timestamp;
    const operationId = generateOperationId("fieldConfig");
    getScenePerformanceTracker().notifyPanelOperationStart({
      operationId,
      panelId: this._panelId,
      panelKey: this._panelKey,
      pluginId: this._pluginId,
      operation: "fieldConfig",
      timestamp: this._applyFieldConfigStartTime,
      metadata: {}
    });
    return (endTimestamp, dataPointsCount, seriesCount) => {
      if (!this._panelKey || !this._applyFieldConfigStartTime) {
        return;
      }
      const duration = endTimestamp - this._applyFieldConfigStartTime;
      getScenePerformanceTracker().notifyPanelOperationComplete({
        operationId,
        panelId: this._panelId,
        panelKey: this._panelKey,
        pluginId: this._pluginId,
        operation: "fieldConfig",
        timestamp: endTimestamp,
        duration,
        metadata: {}
      });
      this._applyFieldConfigStartTime = void 0;
    };
  }
  /**
   * Get panel info for logging - truncates long titles for readability
   */
  _getPanelInfo() {
    let panel;
    try {
      panel = sceneGraph.getAncestor(this, VizPanel);
    } catch (error) {
    }
    let panelTitle = (panel == null ? void 0 : panel.state.title) || this._panelKey || "No-key panel";
    if (panelTitle.length > 30) {
      panelTitle = panelTitle.substring(0, 27) + "...";
    }
    return `VizPanelRenderProfiler [${panelTitle}]`;
  }
  /**
   * Track simple render timing with operation ID correlation
   */
  onSimpleRenderStart(timestamp) {
    if (!this._panelKey) {
      return void 0;
    }
    const operationId = generateOperationId("render");
    getScenePerformanceTracker().notifyPanelOperationStart({
      operationId,
      panelId: this._panelId || "unknown",
      panelKey: this._panelKey,
      pluginId: this._pluginId || "unknown",
      pluginVersion: this._pluginVersion,
      operation: "render",
      timestamp,
      metadata: {}
    });
    return (endTimestamp, duration) => {
      if (!this._panelKey) {
        return;
      }
      getScenePerformanceTracker().notifyPanelOperationComplete({
        operationId,
        panelId: this._panelId || "unknown",
        panelKey: this._panelKey,
        pluginId: this._pluginId || "unknown",
        pluginVersion: this._pluginVersion,
        operation: "render",
        duration,
        timestamp: endTimestamp,
        metadata: {}
      });
    };
  }
  /** Handle plugin changes */
  _onPluginChange(panel, newPluginId) {
    var _a, _b;
    this._pluginId = newPluginId;
    const plugin = panel.getPlugin();
    this._pluginVersion = (_b = (_a = plugin == null ? void 0 : plugin.meta) == null ? void 0 : _a.info) == null ? void 0 : _b.version;
    writeSceneLog(this._getPanelInfo(), `Plugin changed to ${newPluginId}`);
  }
  /** Start tracking this panel */
  _startTracking() {
    if (!this._panelKey || !this._pluginId || this._isTracking) {
      return;
    }
    this._isTracking = true;
  }
  /** Cleanup when behavior is deactivated */
  _cleanup() {
    this._activeQueries.clear();
    this._isTracking = false;
    writeSceneLog(this._getPanelInfo(), "Cleaned up");
  }
  /**
   * Track data transformation with operation ID correlation
   */
  onDataTransformStart(timestamp, transformationId, metrics) {
    if (!this._panelKey) {
      return null;
    }
    const operationId = generateOperationId("transform");
    getScenePerformanceTracker().notifyPanelOperationStart({
      operationId,
      panelId: this._panelId,
      panelKey: this._panelKey,
      pluginId: this._pluginId,
      operation: "transform",
      timestamp,
      metadata: {
        transformationId,
        transformationCount: metrics.transformationCount,
        seriesTransformationCount: metrics.seriesTransformationCount,
        annotationTransformationCount: metrics.annotationTransformationCount
      }
    });
    return (endTimestamp, duration, success, result) => {
      if (!this._panelKey) {
        return;
      }
      getScenePerformanceTracker().notifyPanelOperationComplete({
        operationId,
        panelId: this._panelId,
        panelKey: this._panelKey,
        pluginId: this._pluginId,
        operation: "transform",
        timestamp: endTimestamp,
        duration,
        metadata: {
          transformationId,
          transformationCount: metrics.transformationCount,
          seriesTransformationCount: metrics.seriesTransformationCount,
          annotationTransformationCount: metrics.annotationTransformationCount,
          success,
          error: (result == null ? void 0 : result.error) || (!success ? "Transform operation failed" : void 0)
        }
      });
    };
  }
}

export { VizPanelRenderProfiler };
//# sourceMappingURL=VizPanelRenderProfiler.js.map
