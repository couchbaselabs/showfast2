import React from 'react';
import { rangeUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { RefreshPicker } from '@grafana/ui';
import { SceneObjectBase } from '../core/SceneObjectBase.js';
import { sceneGraph } from '../core/sceneGraph/index.js';
import { SceneObjectUrlSyncConfig } from '../services/SceneObjectUrlSyncConfig.js';
import { REFRESH_INTERACTION } from '../performance/interactionConstants.js';
import { t } from '@grafana/i18n';

const DEFAULT_INTERVALS = ["5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"];
class SceneRefreshPicker extends SceneObjectBase {
  constructor(state) {
    var _a, _b, _c;
    const filterDissalowedIntervals = (i) => {
      var _a2;
      const minInterval = (_a2 = state.minRefreshInterval) != null ? _a2 : config.minRefreshInterval;
      try {
        return minInterval ? rangeUtil.intervalToMs(i) >= rangeUtil.intervalToMs(minInterval) : true;
      } catch (e) {
        return false;
      }
    };
    super({
      refresh: "",
      ...state,
      autoValue: void 0,
      autoEnabled: (_a = state.autoEnabled) != null ? _a : true,
      autoMinInterval: (_b = state.autoMinInterval) != null ? _b : config.minRefreshInterval,
      intervals: ((_c = state.intervals) != null ? _c : DEFAULT_INTERVALS).filter(filterDissalowedIntervals)
    });
    this._urlSync = new SceneObjectUrlSyncConfig(this, { keys: ["refresh"] });
    this._autoRefreshBlocked = false;
    this.onRefresh = () => {
      const queryController = sceneGraph.getQueryController(this);
      if (queryController == null ? void 0 : queryController.state.isRunning) {
        queryController.cancelAll();
        queryController.cancelProfile();
        return;
      }
      queryController == null ? void 0 : queryController.startProfile(REFRESH_INTERACTION);
      const timeRange = sceneGraph.getTimeRange(this);
      if (this._intervalTimer) {
        clearInterval(this._intervalTimer);
      }
      timeRange.onRefresh();
      this.setupIntervalTimer();
    };
    this.onIntervalChanged = (interval) => {
      this.setState({ refresh: interval });
      this.setupIntervalTimer();
    };
    this.setupAutoTimeRangeListener = () => {
      return sceneGraph.getTimeRange(this).subscribeToState((newState, prevState) => {
        if (newState.from !== prevState.from || newState.to !== prevState.to) {
          this.setupIntervalTimer();
        }
      });
    };
    this.calculateAutoRefreshInterval = () => {
      var _a;
      const timeRange = sceneGraph.getTimeRange(this);
      const resolution = (_a = window == null ? void 0 : window.innerWidth) != null ? _a : 2e3;
      return rangeUtil.calculateInterval(timeRange.state.value, resolution, this.state.autoMinInterval);
    };
    this.setupIntervalTimer = () => {
      var _a;
      const timeRange = sceneGraph.getTimeRange(this);
      const { refresh, intervals } = this.state;
      if (this._intervalTimer || refresh === "") {
        clearInterval(this._intervalTimer);
      }
      if (refresh === "") {
        return;
      }
      if (refresh !== RefreshPicker.autoOption.value && intervals && !intervals.includes(refresh)) {
        return;
      }
      let intervalMs;
      (_a = this._autoTimeRangeListener) == null ? void 0 : _a.unsubscribe();
      if (refresh === RefreshPicker.autoOption.value) {
        const autoRefreshInterval = this.calculateAutoRefreshInterval();
        intervalMs = autoRefreshInterval.intervalMs;
        this._autoTimeRangeListener = this.setupAutoTimeRangeListener();
        if (autoRefreshInterval.interval !== this.state.autoValue) {
          this.setState({ autoValue: autoRefreshInterval.interval });
        }
      } else {
        intervalMs = rangeUtil.intervalToMs(refresh);
      }
      this._intervalTimer = setInterval(() => {
        if (this.isTabVisible()) {
          const queryController = sceneGraph.getQueryController(this);
          if (queryController == null ? void 0 : queryController.state.isRunning) {
            queryController.cancelProfile();
          }
          queryController == null ? void 0 : queryController.startProfile(REFRESH_INTERACTION);
          timeRange.onRefresh();
        } else {
          this._autoRefreshBlocked = true;
        }
      }, intervalMs);
    };
    this.addActivationHandler(() => {
      this.setupIntervalTimer();
      const onVisibilityChange = () => {
        if (this._autoRefreshBlocked && document.visibilityState === "visible") {
          this._autoRefreshBlocked = false;
          this.onRefresh();
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
      return () => {
        var _a2;
        if (this._intervalTimer) {
          clearInterval(this._intervalTimer);
        }
        document.removeEventListener("visibilitychange", onVisibilityChange);
        (_a2 = this._autoTimeRangeListener) == null ? void 0 : _a2.unsubscribe();
      };
    });
  }
  getUrlState() {
    let refresh = this.state.refresh;
    if (typeof refresh !== "string" || refresh.length === 0) {
      refresh = void 0;
    }
    return { refresh };
  }
  updateFromUrl(values) {
    const { intervals } = this.state;
    let refresh = values.refresh;
    if (typeof refresh === "string" && isIntervalString(refresh)) {
      if (intervals == null ? void 0 : intervals.includes(refresh)) {
        this.setState({ refresh });
      } else {
        this.setState({
          // Round down to the largest allowed refresh interval <= the URL interval if the interval from the URL is not allowed.
          refresh: intervals ? findClosestInterval(refresh, intervals) : void 0
        });
      }
    }
  }
  isTabVisible() {
    return document.visibilityState === void 0 || document.visibilityState === "visible";
  }
}
SceneRefreshPicker.Component = SceneRefreshPickerRenderer;
function SceneRefreshPickerRenderer({ model }) {
  var _a;
  const { refresh, intervals, autoEnabled, autoValue, isOnCanvas, primary, withText } = model.useState();
  const isRunning = useQueryControllerState(model);
  let text = refresh === ((_a = RefreshPicker.autoOption) == null ? void 0 : _a.value) ? autoValue : withText ? t("grafana-scenes.components.scene-refresh-picker.text-refresh", "Refresh") : void 0;
  let tooltip;
  let width;
  if (isRunning) {
    tooltip = t("grafana-scenes.components.scene-refresh-picker.tooltip-cancel", "Cancel all queries");
    if (withText) {
      text = t("grafana-scenes.components.scene-refresh-picker.text-cancel", "Cancel");
    }
  }
  if (withText) {
    width = "96px";
  }
  return /* @__PURE__ */ React.createElement(
    RefreshPicker,
    {
      showAutoInterval: autoEnabled,
      value: refresh,
      intervals,
      tooltip,
      width,
      text,
      onRefresh: () => {
        model.onRefresh();
      },
      primary,
      onIntervalChanged: model.onIntervalChanged,
      isLoading: isRunning,
      isOnCanvas: isOnCanvas != null ? isOnCanvas : true
    }
  );
}
function useQueryControllerState(model) {
  const queryController = sceneGraph.getQueryController(model);
  if (!queryController) {
    return false;
  }
  return queryController.useState().isRunning;
}
function isIntervalString(str) {
  try {
    const res = rangeUtil.describeInterval(str);
    return res.count > 0;
  } catch (e) {
    return false;
  }
}
function findClosestInterval(userInterval, allowedIntervals) {
  if (allowedIntervals.length === 0) {
    return void 0;
  }
  const userIntervalMs = rangeUtil.intervalToMs(userInterval);
  let selectedInterval = allowedIntervals[0];
  for (let i = 1; i < allowedIntervals.length; i++) {
    const intervalMs = rangeUtil.intervalToMs(allowedIntervals[i]);
    if (intervalMs > userIntervalMs) {
      break;
    }
    selectedInterval = allowedIntervals[i];
  }
  return selectedInterval;
}

export { DEFAULT_INTERVALS, SceneRefreshPicker, SceneRefreshPickerRenderer };
//# sourceMappingURL=SceneRefreshPicker.js.map
