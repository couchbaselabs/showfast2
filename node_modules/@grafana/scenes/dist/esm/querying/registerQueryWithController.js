import { Observable, from, map, catchError } from 'rxjs';
import { LoadingState } from '@grafana/schema';
import { sceneGraph } from '../core/sceneGraph/index.js';
import { generateOperationId, getScenePerformanceTracker } from '../performance/ScenePerformanceTracker.js';

function registerQueryWithController(entry, profiler) {
  return (queryStream) => {
    const queryControler = sceneGraph.getQueryController(entry.origin);
    if (!queryControler) {
      return queryStream;
    }
    return new Observable((observer) => {
      var _a;
      if (!entry.cancel) {
        entry.cancel = () => observer.complete();
      }
      const queryId = ((_a = entry.request) == null ? void 0 : _a.requestId) || `${entry.type}-${Math.floor(performance.now()).toString(36)}`;
      const startTimestamp = performance.now();
      let endQueryCallback = null;
      if (profiler) {
        endQueryCallback = profiler.onQueryStarted(startTimestamp, entry, queryId);
      } else {
        const operationId = generateOperationId("query");
        getScenePerformanceTracker().notifyQueryStart({
          operationId,
          queryId,
          queryType: entry.type,
          origin: entry.origin.constructor.name,
          timestamp: startTimestamp
        });
        endQueryCallback = (endTimestamp, error) => {
          getScenePerformanceTracker().notifyQueryComplete({
            operationId,
            queryId,
            queryType: entry.type,
            origin: entry.origin.constructor.name,
            timestamp: endTimestamp,
            duration: endTimestamp - startTimestamp,
            error: error ? (error == null ? void 0 : error.message) || String(error) || "Unknown error" : void 0
          });
        };
      }
      queryControler.queryStarted(entry);
      let markedAsCompleted = false;
      const sub = queryStream.subscribe({
        next: (v) => {
          if (!markedAsCompleted && v.state !== LoadingState.Loading) {
            markedAsCompleted = true;
            queryControler.queryCompleted(entry);
            endQueryCallback == null ? void 0 : endQueryCallback(performance.now());
          }
          observer.next(v);
        },
        error: (e) => {
          if (!markedAsCompleted) {
            markedAsCompleted = true;
            queryControler.queryCompleted(entry);
            endQueryCallback == null ? void 0 : endQueryCallback(performance.now(), e);
          }
          observer.error(e);
        },
        complete: () => {
          observer.complete();
        }
      });
      return () => {
        sub.unsubscribe();
        if (!markedAsCompleted) {
          queryControler.queryCompleted(entry);
          endQueryCallback == null ? void 0 : endQueryCallback(performance.now());
        }
      };
    });
  };
}
function wrapPromiseInStateObservable(promise) {
  return new Observable((observer) => {
    observer.next({ state: LoadingState.Loading });
    const promiseObservable = from(promise);
    promiseObservable.pipe(
      map(() => ({ state: LoadingState.Done })),
      catchError(() => {
        observer.next({ state: LoadingState.Error });
        return [];
      })
    ).subscribe({
      next: (result) => observer.next(result),
      complete: () => observer.complete()
    });
  });
}

export { registerQueryWithController, wrapPromiseInStateObservable };
//# sourceMappingURL=registerQueryWithController.js.map
