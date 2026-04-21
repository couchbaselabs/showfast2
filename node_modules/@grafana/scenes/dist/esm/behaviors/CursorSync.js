import { DashboardCursorSync } from '@grafana/schema';
import { Observable } from 'rxjs';
import { sceneGraph } from '../core/sceneGraph/index.js';
import { SceneObjectBase } from '../core/SceneObjectBase.js';

class CursorSync extends SceneObjectBase {
  constructor(state) {
    super({
      ...state,
      sync: state.sync || DashboardCursorSync.Off
    });
    this.getEventsBus = (panel) => {
      if (!this.parent) {
        throw new Error("EnableCursorSync cannot be used as a standalone scene object");
      }
      return new PanelContextEventBus(this.parent, panel);
    };
  }
  getEventsScope() {
    if (!this.parent) {
      throw new Error("EnableCursorSync cannot be used as a standalone scene object");
    }
    return this.state.key;
  }
}
class PanelContextEventBus {
  constructor(_source, _eventsOrigin) {
    this._source = _source;
    this._eventsOrigin = _eventsOrigin;
  }
  publish(event) {
    event.origin = this;
    this._eventsOrigin.publishEvent(event, true);
  }
  getStream(eventType) {
    return new Observable((observer) => {
      const handler = (event) => {
        observer.next(event);
      };
      const sub = this._source.subscribeToEvent(eventType, handler);
      return () => sub.unsubscribe();
    });
  }
  subscribe(eventType, handler) {
    return this.getStream(eventType).pipe().subscribe(handler);
  }
  removeAllListeners() {
  }
  newScopedBus(key, filter) {
    throw new Error("For internal use only");
  }
}
function getCursorSyncScope(sceneObject) {
  return sceneGraph.findObject(sceneObject, (o) => o instanceof CursorSync);
}

export { CursorSync, getCursorSyncScope };
//# sourceMappingURL=CursorSync.js.map
