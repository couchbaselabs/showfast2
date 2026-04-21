import { getDefaultTimeRange } from '@grafana/data';
import { LoadingState } from '@grafana/schema';
import { of } from 'rxjs';
import { SceneObjectBase } from './SceneObjectBase.js';

class SceneDataNode extends SceneObjectBase {
  constructor(state) {
    super({
      data: emptyPanelData,
      ...state
    });
  }
  getResultsStream() {
    const result = {
      origin: this,
      data: this.state.data
    };
    return of(result);
  }
}
const emptyPanelData = {
  state: LoadingState.Done,
  series: [],
  timeRange: getDefaultTimeRange()
};

export { SceneDataNode, emptyPanelData };
//# sourceMappingURL=SceneDataNode.js.map
