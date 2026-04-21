import { writePerformanceLog } from '../utils/writePerformanceLog.js';

var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), member.set(obj, value), value);
var _isTracking, _callback, _frameTrackingId, _lastFrameTime, _loafObserver;
const LONG_FRAME_THRESHOLD = 50;
class LongFrameDetector {
  constructor() {
    __privateAdd(this, _isTracking, false);
    __privateAdd(this, _callback, null);
    // Manual tracking state
    __privateAdd(this, _frameTrackingId, null);
    __privateAdd(this, _lastFrameTime, 0);
    // LoAF tracking state
    __privateAdd(this, _loafObserver, null);
    /**
     * Measure frame durations using requestAnimationFrame
     */
    this.measureFrames = () => {
      if (!__privateGet(this, _isTracking)) {
        return;
      }
      const currentFrameTime = performance.now();
      const frameLength = currentFrameTime - __privateGet(this, _lastFrameTime);
      if (frameLength > LONG_FRAME_THRESHOLD) {
        const event = {
          duration: frameLength,
          timestamp: currentFrameTime,
          method: "manual"
        };
        if (__privateGet(this, _callback)) {
          __privateGet(this, _callback).call(this, event);
        }
        if (typeof performance !== "undefined" && performance.mark && performance.measure) {
          const frameId = `long-frame-manual-${currentFrameTime.toFixed(0)}`;
          const startMarkName = `${frameId}-start`;
          const endMarkName = `${frameId}-end`;
          const measureName = `Long Frame (Manual): ${frameLength.toFixed(1)}ms`;
          try {
            performance.mark(startMarkName, { startTime: currentFrameTime - frameLength });
            performance.mark(endMarkName, { startTime: currentFrameTime });
            performance.measure(measureName, startMarkName, endMarkName);
          } catch (e) {
            performance.mark(measureName);
          }
        }
        writePerformanceLog(
          "LFD",
          `Long frame detected (manual): ${frameLength}ms (threshold: ${LONG_FRAME_THRESHOLD}ms)`
        );
      }
      __privateSet(this, _lastFrameTime, currentFrameTime);
      if (__privateGet(this, _isTracking)) {
        __privateSet(this, _frameTrackingId, requestAnimationFrame(this.measureFrames));
      }
    };
  }
  /**
   * Check if LoAF API is available in the browser
   */
  isLoAFAvailable() {
    return typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.includes("long-animation-frame");
  }
  /**
   * Start detecting long frames and call the provided callback when they occur
   */
  start(callback) {
    if (__privateGet(this, _isTracking)) {
      writePerformanceLog("LFD", "Already tracking frames, stopping previous session");
      this.stop();
    }
    __privateSet(this, _callback, callback);
    __privateSet(this, _isTracking, true);
    if (this.isLoAFAvailable()) {
      this.startLoAFTracking();
    } else {
      this.startManualFrameTracking();
    }
    writePerformanceLog(
      "LFD",
      `Started tracking with ${this.isLoAFAvailable() ? "LoAF API" : "manual"} method, threshold: ${LONG_FRAME_THRESHOLD}ms`
    );
  }
  /**
   * Stop detecting long frames
   */
  stop() {
    if (!__privateGet(this, _isTracking)) {
      return;
    }
    __privateSet(this, _isTracking, false);
    __privateSet(this, _callback, null);
    this.stopLoAFTracking();
    this.stopManualFrameTracking();
  }
  /**
   * Check if currently tracking frames
   */
  isTracking() {
    return __privateGet(this, _isTracking);
  }
  /**
   * Start tracking using the Long Animation Frame API
   * @see https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming
   */
  startLoAFTracking() {
    if (!this.isLoAFAvailable()) {
      writePerformanceLog("LFD", "LoAF API not available, falling back to manual tracking");
      this.startManualFrameTracking();
      return;
    }
    try {
      __privateSet(this, _loafObserver, new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const event = {
            duration: entry.duration,
            timestamp: entry.startTime,
            method: "loaf"
          };
          if (__privateGet(this, _callback)) {
            __privateGet(this, _callback).call(this, event);
          }
          if (typeof performance !== "undefined" && performance.mark && performance.measure) {
            const frameId = `long-frame-${entry.startTime.toFixed(0)}`;
            const startMarkName = `${frameId}-start`;
            const endMarkName = `${frameId}-end`;
            const measureName = `Long Frame (LoAF): ${entry.duration.toFixed(1)}ms`;
            try {
              performance.mark(startMarkName, { startTime: entry.startTime });
              performance.mark(endMarkName, { startTime: entry.startTime + entry.duration });
              performance.measure(measureName, startMarkName, endMarkName);
            } catch (e) {
              performance.mark(measureName);
            }
          }
          writePerformanceLog("LFD", `Long frame detected (LoAF): ${entry.duration}ms at ${entry.startTime}ms`);
        }
      }));
      __privateGet(this, _loafObserver).observe({ type: "long-animation-frame", buffered: false });
    } catch (error) {
      writePerformanceLog("LFD", "Failed to start LoAF tracking, falling back to manual:", error);
      this.startManualFrameTracking();
    }
  }
  /**
   * Stop LoAF tracking
   */
  stopLoAFTracking() {
    if (__privateGet(this, _loafObserver)) {
      __privateGet(this, _loafObserver).disconnect();
      __privateSet(this, _loafObserver, null);
      writePerformanceLog("LFD", "Stopped LoAF tracking");
    }
  }
  /**
   * Start manual frame tracking using requestAnimationFrame
   */
  startManualFrameTracking() {
    __privateSet(this, _lastFrameTime, performance.now());
    __privateSet(this, _frameTrackingId, requestAnimationFrame(() => this.measureFrames()));
  }
  /**
   * Stop manual frame tracking
   */
  stopManualFrameTracking() {
    if (__privateGet(this, _frameTrackingId)) {
      cancelAnimationFrame(__privateGet(this, _frameTrackingId));
      __privateSet(this, _frameTrackingId, null);
      writePerformanceLog("LFD", "Stopped manual frame tracking");
    }
  }
}
_isTracking = new WeakMap();
_callback = new WeakMap();
_frameTrackingId = new WeakMap();
_lastFrameTime = new WeakMap();
_loafObserver = new WeakMap();

export { LongFrameDetector };
//# sourceMappingURL=LongFrameDetector.js.map
