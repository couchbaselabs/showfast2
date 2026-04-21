import { getTimeZone, rangeUtil, setWeekStart, getZone, toUtc } from '@grafana/data';
import { defaultTimeZone } from '@grafana/schema';
import { SceneObjectUrlSyncConfig } from '../services/SceneObjectUrlSyncConfig.js';
import { SceneObjectBase } from './SceneObjectBase.js';
import { getClosest } from './sceneGraph/utils.js';
import { parseUrlParam } from '../utils/parseUrlParam.js';
import { evaluateTimeRange } from '../utils/evaluateTimeRange.js';
import { RefreshEvent, config, locationService } from '@grafana/runtime';
import { isValid } from '../utils/date.js';
import { getQueryController } from './sceneGraph/getQueryController.js';
import { writeSceneLog } from '../utils/writeSceneLog.js';
import { isEmpty } from 'lodash';
import { TIME_RANGE_CHANGE_INTERACTION } from '../performance/interactionConstants.js';

class SceneTimeRange extends SceneObjectBase {
  constructor(state = {}) {
    var _a;
    const from = state.from && isValid(state.from) ? state.from : "now-6h";
    const to = state.to && isValid(state.to) ? state.to : "now";
    const timeZone = getValidTimeZone(state.timeZone);
    const value = evaluateTimeRange(
      from,
      to,
      timeZone || getTimeZone(),
      state.fiscalYearStartMonth,
      state.UNSAFE_nowDelay,
      state.weekStart
    );
    const refreshOnActivate = (_a = state.refreshOnActivate) != null ? _a : { percent: 10 };
    super({ from, to, timeZone, value, refreshOnActivate, ...state });
    this._urlSync = new SceneObjectUrlSyncConfig(this, { keys: ["from", "to", "timezone", "time", "time.window"] });
    this.onTimeRangeChange = (timeRange) => {
      const update = {};
      if (typeof timeRange.raw.from === "string") {
        update.from = timeRange.raw.from;
      } else {
        update.from = timeRange.raw.from.toISOString();
      }
      if (typeof timeRange.raw.to === "string") {
        update.to = timeRange.raw.to;
      } else {
        update.to = timeRange.raw.to.toISOString();
      }
      update.value = evaluateTimeRange(
        update.from,
        update.to,
        this.getTimeZone(),
        this.state.fiscalYearStartMonth,
        this.state.UNSAFE_nowDelay,
        this.state.weekStart
      );
      if (update.from !== this.state.from || update.to !== this.state.to) {
        const queryController = getQueryController(this);
        queryController == null ? void 0 : queryController.startProfile(TIME_RANGE_CHANGE_INTERACTION);
        this._urlSync.performBrowserHistoryAction(() => {
          this.setState(update);
        });
      }
    };
    this.onTimeZoneChange = (timeZone) => {
      this._urlSync.performBrowserHistoryAction(() => {
        var _a;
        const validTimeZone = (_a = getValidTimeZone(timeZone)) != null ? _a : defaultTimeZone;
        const updatedValue = evaluateTimeRange(
          this.state.from,
          this.state.to,
          validTimeZone,
          this.state.fiscalYearStartMonth,
          this.state.UNSAFE_nowDelay,
          this.state.weekStart
        );
        this.setState({ timeZone: validTimeZone, value: updatedValue });
      });
    };
    this.onRefresh = () => {
      this.refreshRange(0);
      this.publishEvent(new RefreshEvent(), true);
    };
    this.addActivationHandler(this._onActivate.bind(this));
  }
  _onActivate() {
    if (!this.state.timeZone) {
      const timeZoneSource = this.getTimeZoneSource();
      if (timeZoneSource !== this) {
        this._subs.add(
          timeZoneSource.subscribeToState((n, p) => {
            if (n.timeZone !== void 0 && n.timeZone !== p.timeZone) {
              this.refreshRange(0);
            }
          })
        );
      }
    }
    if (rangeUtil.isRelativeTimeRange(this.state.value.raw)) {
      this.refreshIfStale();
    }
    return () => {
      if (this.state.weekStart) {
        setWeekStart(config.bootData.user.weekStart);
      }
    };
  }
  refreshIfStale() {
    var _a, _b, _c, _d;
    let ms;
    if (((_b = (_a = this.state) == null ? void 0 : _a.refreshOnActivate) == null ? void 0 : _b.percent) !== void 0) {
      ms = this.calculatePercentOfInterval(this.state.refreshOnActivate.percent);
    }
    if (((_d = (_c = this.state) == null ? void 0 : _c.refreshOnActivate) == null ? void 0 : _d.afterMs) !== void 0) {
      ms = Math.min(this.state.refreshOnActivate.afterMs, ms != null ? ms : Infinity);
    }
    if (ms !== void 0) {
      this.refreshRange(ms);
    }
  }
  /**
   * Will traverse up the scene graph to find the closest SceneTimeRangeLike with time zone set
   */
  getTimeZoneSource() {
    if (!this.parent || !this.parent.parent) {
      return this;
    }
    const source = getClosest(this.parent.parent, (o) => {
      if (o.state.$timeRange && o.state.$timeRange.state.timeZone) {
        return o.state.$timeRange;
      }
      return void 0;
    });
    if (!source) {
      return this;
    }
    return source;
  }
  /**
   * Refreshes time range if it is older than the invalidation interval
   * @param refreshAfterMs invalidation interval (milliseconds)
   * @private
   */
  refreshRange(refreshAfterMs) {
    var _a;
    const value = evaluateTimeRange(
      this.state.from,
      this.state.to,
      (_a = this.state.timeZone) != null ? _a : getTimeZone(),
      this.state.fiscalYearStartMonth,
      this.state.UNSAFE_nowDelay,
      this.state.weekStart
    );
    const diff = value.to.diff(this.state.value.to, "milliseconds");
    if (diff >= refreshAfterMs) {
      this.setState({ value });
    }
  }
  calculatePercentOfInterval(percent) {
    const intervalMs = this.state.value.to.diff(this.state.value.from, "milliseconds");
    return Math.ceil(intervalMs / 100 * percent);
  }
  getTimeZone() {
    if (this.state.timeZone && getValidTimeZone(this.state.timeZone)) {
      return this.state.timeZone;
    }
    const timeZoneSource = this.getTimeZoneSource();
    if (timeZoneSource !== this && getValidTimeZone(timeZoneSource.state.timeZone)) {
      return timeZoneSource.state.timeZone;
    }
    return getTimeZone();
  }
  getUrlState() {
    const params = locationService.getSearchObject();
    const urlValues = { from: this.state.from, to: this.state.to, timezone: this.getTimeZone() };
    if (params.time && params["time.window"]) {
      urlValues.time = null;
      urlValues["time.window"] = null;
    }
    return urlValues;
  }
  updateFromUrl(values) {
    var _a, _b, _c;
    const update = {};
    let from = parseUrlParam(values.from);
    let to = parseUrlParam(values.to);
    if (values.time && values["time.window"]) {
      const time = Array.isArray(values.time) ? values.time[0] : values.time;
      const timeWindow = Array.isArray(values["time.window"]) ? values["time.window"][0] : values["time.window"];
      const timeRange = getTimeWindow(time, timeWindow);
      if (timeRange.from && isValid(timeRange.from)) {
        from = timeRange.from;
      }
      if (timeRange.to && isValid(timeRange.to)) {
        to = timeRange.to;
      }
    }
    if (from && isValid(from)) {
      update.from = from;
    }
    if (to && isValid(to)) {
      update.to = to;
    }
    if (typeof values.timezone === "string") {
      update.timeZone = values.timezone !== "" ? values.timezone : void 0;
    }
    if (Object.keys(update).length === 0) {
      return;
    }
    update.value = evaluateTimeRange(
      (_a = update.from) != null ? _a : this.state.from,
      (_b = update.to) != null ? _b : this.state.to,
      (_c = update.timeZone) != null ? _c : this.getTimeZone(),
      this.state.fiscalYearStartMonth,
      this.state.UNSAFE_nowDelay,
      this.state.weekStart
    );
    return this.setState(update);
  }
}
function getTimeWindow(time, timeWindow) {
  const valueTime = isNaN(Date.parse(time)) ? parseInt(time, 10) : Date.parse(time);
  let timeWindowMs;
  if (timeWindow.match(/^\d+$/) && parseInt(timeWindow, 10)) {
    timeWindowMs = parseInt(timeWindow, 10);
  } else {
    timeWindowMs = rangeUtil.intervalToMs(timeWindow);
  }
  return {
    from: toUtc(valueTime - timeWindowMs / 2).toISOString(),
    to: toUtc(valueTime + timeWindowMs / 2).toISOString()
  };
}
function getValidTimeZone(timeZone) {
  if (timeZone === void 0) {
    return void 0;
  }
  if (isEmpty(timeZone)) {
    return config.bootData.user.timezone;
  }
  if (timeZone === defaultTimeZone) {
    return timeZone;
  }
  if (getZone(timeZone)) {
    return timeZone;
  }
  writeSceneLog("SceneTimeRange", `Invalid timeZone "${timeZone}" provided.`);
  return;
}

export { SceneTimeRange };
//# sourceMappingURL=SceneTimeRange.js.map
