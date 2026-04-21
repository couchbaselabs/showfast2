import { SceneTimeRangeTransformerBase } from './SceneTimeRangeTransformerBase.js';
import { getDefaultTimeRange } from '@grafana/data';
import { evaluateTimeRange } from '../utils/evaluateTimeRange.js';

class SceneTimeZoneOverride extends SceneTimeRangeTransformerBase {
  constructor(state) {
    super({
      ...state,
      timeZone: state.timeZone,
      // We set a default time range here. It will be overwritten on activation based on ancestor time range.
      from: "now-6h",
      to: "now",
      value: getDefaultTimeRange()
    });
  }
  ancestorTimeRangeChanged(timeRange) {
    this.setState({
      ...timeRange,
      timeZone: this.state.timeZone,
      value: evaluateTimeRange(
        timeRange.from,
        timeRange.to,
        this.state.timeZone,
        timeRange.fiscalYearStartMonth,
        timeRange.UNSAFE_nowDelay,
        timeRange.weekStart
      )
    });
  }
  getTimeZone() {
    return this.state.timeZone;
  }
  onTimeZoneChange(timeZone) {
    const parentTimeRange = this.getAncestorTimeRange();
    this.setState({
      timeZone,
      value: evaluateTimeRange(
        parentTimeRange.state.from,
        parentTimeRange.state.to,
        timeZone,
        parentTimeRange.state.fiscalYearStartMonth,
        parentTimeRange.state.UNSAFE_nowDelay,
        parentTimeRange.state.weekStart
      )
    });
  }
}

export { SceneTimeZoneOverride };
//# sourceMappingURL=SceneTimeZoneOverride.js.map
