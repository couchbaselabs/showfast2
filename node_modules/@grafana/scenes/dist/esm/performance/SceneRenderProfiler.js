import { writePerformanceLog } from '../utils/writePerformanceLog.js';
import { generateOperationId, getScenePerformanceTracker } from './ScenePerformanceTracker.js';
import { PanelProfilingManager } from './PanelProfilingManager.js';
import { LongFrameDetector } from './LongFrameDetector.js';

var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), member.set(obj, value), value);
var __privateWrapper = (obj, member, setter, getter) => ({
  set _(value) {
    __privateSet(obj, member, value);
  },
  get _() {
    return __privateGet(obj, member, getter);
  }
});
var _profileInProgress, _interactionInProgress, _profileStartTs, _trailAnimationFrameId, _currentOperationId, _recordedTrailingSpans, _longFrameDetector, _longFramesCount, _longFramesTotalTime, _visibilityChangeHandler, _onInteractionComplete;
const POST_STORM_WINDOW = 2e3;
const DEFAULT_LONG_FRAME_THRESHOLD = 30;
class SceneRenderProfiler {
  constructor(panelProfilingConfig) {
    __privateAdd(this, _profileInProgress, null);
    __privateAdd(this, _interactionInProgress, null);
    __privateAdd(this, _profileStartTs, null);
    __privateAdd(this, _trailAnimationFrameId, null);
    // Generic metadata for observer notifications
    this.metadata = {};
    // Operation ID for correlating dashboard interaction events
    __privateAdd(this, _currentOperationId);
    // Trailing frame measurements
    __privateAdd(this, _recordedTrailingSpans, []);
    // Long frame tracking
    __privateAdd(this, _longFrameDetector);
    __privateAdd(this, _longFramesCount, 0);
    __privateAdd(this, _longFramesTotalTime, 0);
    __privateAdd(this, _visibilityChangeHandler, null);
    __privateAdd(this, _onInteractionComplete, null);
    this.measureTrailingFrames = (measurementStartTs, lastFrameTime, profileStartTs) => {
      const currentFrameTime = performance.now();
      const frameLength = currentFrameTime - lastFrameTime;
      __privateGet(this, _recordedTrailingSpans).push(frameLength);
      if (currentFrameTime - measurementStartTs < POST_STORM_WINDOW) {
        if (__privateGet(this, _profileInProgress)) {
          __privateSet(this, _trailAnimationFrameId, requestAnimationFrame(
            () => this.measureTrailingFrames(measurementStartTs, currentFrameTime, profileStartTs)
          ));
        }
      } else {
        const slowFrames = processRecordedSpans(__privateGet(this, _recordedTrailingSpans));
        const slowFramesTime = slowFrames.reduce((acc, val) => acc + val, 0);
        writePerformanceLog(
          "SRP",
          "Profile tail recorded, slow frames duration:",
          slowFramesTime,
          slowFrames,
          __privateGet(this, _profileInProgress)
        );
        __privateSet(this, _recordedTrailingSpans, []);
        const profileDuration = measurementStartTs - profileStartTs;
        const slowFrameSummary = slowFrames.length > 0 ? `${slowFramesTime.toFixed(1)}ms slow frames[tail recording] (${slowFrames.length}) \u26A0\uFE0F` : `${slowFramesTime.toFixed(1)}ms slow frames[tail recording] (${slowFrames.length})`;
        const longFrameSummary = __privateGet(this, _longFramesCount) > 0 ? `${__privateGet(this, _longFramesTotalTime).toFixed(1)}ms long frames[LoAF] (${__privateGet(this, _longFramesCount)}) \u26A0\uFE0F` : `${__privateGet(this, _longFramesTotalTime).toFixed(1)}ms long frames[LoAF] (${__privateGet(this, _longFramesCount)})`;
        writePerformanceLog(
          "SRP",
          `[PROFILER] Complete: ${(profileDuration + slowFramesTime).toFixed(
            1
          )}ms total | ${slowFrameSummary} | ${longFrameSummary}`
        );
        __privateGet(this, _longFrameDetector).stop();
        __privateSet(this, _trailAnimationFrameId, null);
        const profileEndTs = profileStartTs + profileDuration + slowFramesTime;
        if (!__privateGet(this, _profileInProgress)) {
          return;
        }
        const networkDuration = captureNetwork(profileStartTs, profileEndTs);
        if (__privateGet(this, _profileInProgress)) {
          const dashboardData = {
            operationId: __privateGet(this, _currentOperationId) || generateOperationId("dashboard-fallback"),
            interactionType: __privateGet(this, _profileInProgress).origin,
            timestamp: profileEndTs,
            duration: profileDuration + slowFramesTime,
            networkDuration,
            longFramesCount: __privateGet(this, _longFramesCount),
            longFramesTotalTime: __privateGet(this, _longFramesTotalTime),
            metadata: this.metadata
          };
          const tracker = getScenePerformanceTracker();
          tracker.notifyDashboardInteractionComplete(dashboardData);
          __privateSet(this, _profileInProgress, null);
          __privateSet(this, _trailAnimationFrameId, null);
        }
      }
    };
    __privateSet(this, _longFrameDetector, new LongFrameDetector());
    this.setupVisibilityChangeHandler();
    __privateSet(this, _interactionInProgress, null);
    if (panelProfilingConfig) {
      this._panelProfilingManager = new PanelProfilingManager(panelProfilingConfig);
    }
  }
  /** Set generic metadata for observer notifications */
  setMetadata(metadata) {
    this.metadata = { ...metadata };
  }
  setQueryController(queryController) {
    this.queryController = queryController;
  }
  /** Attach panel profiling to a scene object */
  attachPanelProfiling(sceneObject) {
    var _a;
    (_a = this._panelProfilingManager) == null ? void 0 : _a.attachToScene(sceneObject);
  }
  /** Attach profiler to a specific panel */
  attachProfilerToPanel(panel) {
    var _a;
    writePerformanceLog("SRP", "Attaching profiler to panel", panel.state.key);
    (_a = this._panelProfilingManager) == null ? void 0 : _a.attachProfilerToPanel(panel);
  }
  setInteractionCompleteHandler(handler) {
    __privateSet(this, _onInteractionComplete, handler != null ? handler : null);
  }
  setupVisibilityChangeHandler() {
    if (__privateGet(this, _visibilityChangeHandler)) {
      return;
    }
    __privateSet(this, _visibilityChangeHandler, () => {
      if (document.hidden && __privateGet(this, _profileInProgress)) {
        writePerformanceLog("SRP", "Tab became inactive, cancelling profile");
        this.cancelProfile();
      }
    });
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", __privateGet(this, _visibilityChangeHandler));
    }
  }
  cleanup() {
    var _a;
    if (__privateGet(this, _visibilityChangeHandler) && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", __privateGet(this, _visibilityChangeHandler));
      __privateSet(this, _visibilityChangeHandler, null);
    }
    __privateGet(this, _longFrameDetector).stop();
    this.cancelProfile();
    (_a = this._panelProfilingManager) == null ? void 0 : _a.cleanup();
  }
  startProfile(name) {
    if (document.hidden) {
      writePerformanceLog("SRP", "Tab is inactive, skipping profile", name);
      return;
    }
    if (__privateGet(this, _profileInProgress)) {
      if (__privateGet(this, _trailAnimationFrameId)) {
        this.cancelProfile();
        this._startNewProfile(name, true);
      } else {
        this.addCrumb(name);
      }
    } else {
      this._startNewProfile(name);
    }
  }
  startInteraction(interaction) {
    if (__privateGet(this, _interactionInProgress)) {
      writePerformanceLog("SRP", "Cancelled interaction:", __privateGet(this, _interactionInProgress));
      __privateSet(this, _interactionInProgress, null);
    }
    __privateSet(this, _interactionInProgress, {
      interaction,
      startTs: performance.now()
    });
    writePerformanceLog("SRP", "Started interaction:", interaction);
  }
  stopInteraction() {
    if (!__privateGet(this, _interactionInProgress)) {
      return;
    }
    const endTs = performance.now();
    const interactionDuration = endTs - __privateGet(this, _interactionInProgress).startTs;
    const networkDuration = captureNetwork(__privateGet(this, _interactionInProgress).startTs, endTs);
    writePerformanceLog(
      "SRP",
      `[INTERACTION] Complete: ${interactionDuration.toFixed(1)}ms total | ${networkDuration.toFixed(1)}ms network`
    );
    if (__privateGet(this, _onInteractionComplete) && __privateGet(this, _profileInProgress)) {
      __privateGet(this, _onInteractionComplete).call(this, {
        origin: __privateGet(this, _interactionInProgress).interaction,
        duration: interactionDuration,
        networkDuration,
        startTs: __privateGet(this, _interactionInProgress).startTs,
        endTs
      });
    }
    performance.mark(`${__privateGet(this, _interactionInProgress).interaction}_start`, {
      startTime: __privateGet(this, _interactionInProgress).startTs
    });
    performance.mark(`${__privateGet(this, _interactionInProgress).interaction}_end`, {
      startTime: endTs
    });
    performance.measure(
      `Interaction_${__privateGet(this, _interactionInProgress).interaction}`,
      `${__privateGet(this, _interactionInProgress).interaction}_start`,
      `${__privateGet(this, _interactionInProgress).interaction}_end`
    );
    __privateSet(this, _interactionInProgress, null);
  }
  getCurrentInteraction() {
    var _a, _b;
    return (_b = (_a = __privateGet(this, _interactionInProgress)) == null ? void 0 : _a.interaction) != null ? _b : null;
  }
  /**
   * Start new performance profile
   * @param name - Profile trigger (e.g., 'time_range_change')
   * @param force - True if canceling existing profile, false if starting clean
   */
  _startNewProfile(name, force = false) {
    const profileType = force ? "forced" : "clean";
    writePerformanceLog("SRP", `[PROFILER] ${name} started (${profileType})`);
    __privateSet(this, _profileInProgress, { origin: name, crumbs: [] });
    __privateSet(this, _profileStartTs, performance.now());
    __privateSet(this, _longFramesCount, 0);
    __privateSet(this, _longFramesTotalTime, 0);
    __privateSet(this, _currentOperationId, generateOperationId("dashboard"));
    getScenePerformanceTracker().notifyDashboardInteractionStart({
      operationId: __privateGet(this, _currentOperationId),
      interactionType: name,
      timestamp: __privateGet(this, _profileStartTs),
      metadata: this.metadata
    });
    __privateGet(this, _longFrameDetector).start((event) => {
      if (!__privateGet(this, _profileInProgress) || !__privateGet(this, _profileStartTs)) {
        return;
      }
      if (event.timestamp < __privateGet(this, _profileStartTs)) {
        return;
      }
      __privateWrapper(this, _longFramesCount)._++;
      __privateSet(this, _longFramesTotalTime, __privateGet(this, _longFramesTotalTime) + event.duration);
    });
  }
  recordProfileTail(measurementStartTime, profileStartTs) {
    __privateSet(this, _trailAnimationFrameId, requestAnimationFrame(
      () => this.measureTrailingFrames(measurementStartTime, measurementStartTime, profileStartTs)
    ));
  }
  tryCompletingProfile() {
    var _a;
    writePerformanceLog("SRP", "Trying to complete profile", __privateGet(this, _profileInProgress));
    if (((_a = this.queryController) == null ? void 0 : _a.runningQueriesCount()) === 0 && __privateGet(this, _profileInProgress)) {
      writePerformanceLog("SRP", "All queries completed, stopping profile");
      this.recordProfileTail(performance.now(), __privateGet(this, _profileStartTs));
    }
  }
  isTailRecording() {
    return Boolean(__privateGet(this, _trailAnimationFrameId));
  }
  cancelTailRecording() {
    if (__privateGet(this, _trailAnimationFrameId)) {
      cancelAnimationFrame(__privateGet(this, _trailAnimationFrameId));
      __privateSet(this, _trailAnimationFrameId, null);
      writePerformanceLog("SRP", "Cancelled recording frames, new profile started");
    }
  }
  cancelProfile() {
    if (__privateGet(this, _profileInProgress)) {
      writePerformanceLog("SRP", "Cancelling profile", __privateGet(this, _profileInProgress));
      __privateSet(this, _profileInProgress, null);
      if (__privateGet(this, _trailAnimationFrameId)) {
        cancelAnimationFrame(__privateGet(this, _trailAnimationFrameId));
        __privateSet(this, _trailAnimationFrameId, null);
      }
      __privateGet(this, _longFrameDetector).stop();
      writePerformanceLog("SRP", "Stopped long frame detection - profile cancelled");
      __privateSet(this, _recordedTrailingSpans, []);
      __privateSet(this, _longFramesCount, 0);
      __privateSet(this, _longFramesTotalTime, 0);
    }
  }
  addCrumb(crumb) {
    if (__privateGet(this, _profileInProgress)) {
      getScenePerformanceTracker().notifyDashboardInteractionMilestone({
        operationId: generateOperationId("dashboard-milestone"),
        interactionType: __privateGet(this, _profileInProgress).origin,
        timestamp: performance.now(),
        milestone: crumb,
        metadata: this.metadata
      });
      __privateGet(this, _profileInProgress).crumbs.push(crumb);
    }
  }
}
_profileInProgress = new WeakMap();
_interactionInProgress = new WeakMap();
_profileStartTs = new WeakMap();
_trailAnimationFrameId = new WeakMap();
_currentOperationId = new WeakMap();
_recordedTrailingSpans = new WeakMap();
_longFrameDetector = new WeakMap();
_longFramesCount = new WeakMap();
_longFramesTotalTime = new WeakMap();
_visibilityChangeHandler = new WeakMap();
_onInteractionComplete = new WeakMap();
function processRecordedSpans(spans) {
  for (let i = spans.length - 1; i >= 0; i--) {
    if (spans[i] > DEFAULT_LONG_FRAME_THRESHOLD) {
      return spans.slice(0, i + 1);
    }
  }
  return [spans[0]];
}
function captureNetwork(startTs, endTs) {
  const entries = performance.getEntriesByType("resource");
  performance.clearResourceTimings();
  const networkEntries = entries.filter(
    (entry) => entry.startTime >= startTs && entry.startTime <= endTs && entry.responseEnd >= startTs && entry.responseEnd <= endTs
  );
  for (const entry of networkEntries) {
    performance.measure("Network entry " + entry.name, {
      start: entry.startTime,
      end: entry.responseEnd
    });
  }
  return calculateNetworkTime(networkEntries);
}
function calculateNetworkTime(requests) {
  if (requests.length === 0) {
    return 0;
  }
  requests.sort((a, b) => a.startTime - b.startTime);
  let totalNetworkTime = 0;
  let currentStart = requests[0].startTime;
  let currentEnd = requests[0].responseEnd;
  for (let i = 1; i < requests.length; i++) {
    if (requests[i].startTime <= currentEnd) {
      currentEnd = Math.max(currentEnd, requests[i].responseEnd);
    } else {
      totalNetworkTime += currentEnd - currentStart;
      currentStart = requests[i].startTime;
      currentEnd = requests[i].responseEnd;
    }
  }
  totalNetworkTime += currentEnd - currentStart;
  return totalNetworkTime;
}

export { SceneRenderProfiler, calculateNetworkTime, captureNetwork, processRecordedSpans };
//# sourceMappingURL=SceneRenderProfiler.js.map
