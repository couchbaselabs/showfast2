import React, { useCallback, useEffect, useState } from 'react';
import { BenchmarkDetailDrawer } from '../../pages/Explore/BenchmarkDetailDrawer';
import { RunDetail, fetchRunDetail } from '../../pages/Explore/detailService';

interface DetailState {
  runId: string;
  metricId: string;
  data: RunDetail | null;
  failed: boolean;
}

export function BenchmarkDetailController({ children }: { children: React.ReactNode }) {
  const [detailState, setDetailState] = useState<DetailState | null>(null);

  // Intercept clicks on Grafana data-link anchors that carry detailRunId.
  // Capture phase fires before Grafana's own navigation handler so we can
  // preventDefault — the drawer state lives only in React, never in the URL,
  // which prevents Grafana's variable URL sync from accidentally re-opening it
  // when the user navigates between components or variants.
  const handleClick = useCallback((e: MouseEvent) => {
    const target = e.target;
    if (!(target instanceof Element)) {
      return;
    }
    const anchor = target.closest('a');
    if (!anchor) {
      return;
    }
    const href = anchor.getAttribute('href') ?? '';
    if (!href.includes('detailRunId')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const url = new URL(href, window.location.origin);
    // Take the last occurrence in case ${__url.params} already carried a
    // stale detailRunId from a previous click.
    const runIds = url.searchParams.getAll('detailRunId');
    const metricIds = url.searchParams.getAll('detailMetricId');
    const runId = runIds[runIds.length - 1] ?? '';
    const metricId = metricIds[metricIds.length - 1] ?? '';
    if (runId && metricId) {
      // Setting state in an event handler is always safe — no effect cascade.
      setDetailState({ runId, metricId, data: null, failed: false });
    }
  }, []);

  useEffect(() => {
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [handleClick]);

  // Fetch whenever a new (runId, metricId) key is set.
  // All setState calls here live inside async callbacks — never synchronously
  // in the effect body — which satisfies Grafana's no-cascading-renders rule.
  useEffect(() => {
    if (!detailState || detailState.data !== null || detailState.failed) {
      return;
    }
    const { runId, metricId } = detailState;
    let cancelled = false;

    fetchRunDetail(runId, metricId)
      .then((data) => {
        if (!cancelled) {
          setDetailState((s) =>
            s?.runId === runId && s?.metricId === metricId ? { ...s, data } : s
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetailState((s) =>
            s?.runId === runId && s?.metricId === metricId ? { ...s, failed: true } : s
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [detailState?.runId, detailState?.metricId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onClose = useCallback(() => {
    setDetailState(null);
  }, []);

  const loading = detailState !== null && detailState.data === null && !detailState.failed;

  return (
    <>
      {children}
      {detailState && (
        <BenchmarkDetailDrawer detail={detailState.data} loading={loading} onClose={onClose} />
      )}
    </>
  );
}
