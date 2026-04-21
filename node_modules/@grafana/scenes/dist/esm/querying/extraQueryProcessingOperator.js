import { of, mergeMap, forkJoin, map } from 'rxjs';

const passthroughProcessor = (_, secondary) => of(secondary);
const extraQueryProcessingOperator = (processors) => (data) => {
  return data.pipe(
    mergeMap(([primary, ...secondaries]) => {
      const processedSecondaries = secondaries.flatMap((s) => {
        var _a, _b;
        return (_b = (_a = processors.get(s.request.requestId)) == null ? void 0 : _a(primary, s)) != null ? _b : of(s);
      });
      return forkJoin([of(primary), ...processedSecondaries]);
    }),
    map(([primary, ...processedSecondaries]) => {
      var _a;
      return {
        ...primary,
        series: [...primary.series, ...processedSecondaries.flatMap((s) => s.series)],
        annotations: [...(_a = primary.annotations) != null ? _a : [], ...processedSecondaries.flatMap((s) => {
          var _a2;
          return (_a2 = s.annotations) != null ? _a2 : [];
        })]
      };
    })
  );
};

export { extraQueryProcessingOperator, passthroughProcessor };
//# sourceMappingURL=extraQueryProcessingOperator.js.map
