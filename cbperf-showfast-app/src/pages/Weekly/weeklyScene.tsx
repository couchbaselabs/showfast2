import React, { useEffect, useMemo, useState } from 'react';
import { EmbeddedScene, SceneFlexItem, SceneFlexLayout, SceneReactObject } from '@grafana/scenes';
import { LinkButton, LoadingPlaceholder, useTheme2 } from '@grafana/ui';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { API_BASE_URL, ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';
import { buildBarChartPanelItem } from '../Timelines/timelinesPanelBuilder';
import { TimelinePanel } from '../Timelines/timelinesApiTypes';

// ── API types ─────────────────────────────────────────────────────────────────

interface WeeklyBuildEntry {
  build: string;
  date: string;
  active: boolean;
}

interface WeeklyMetricResult {
  metricId: string;
  title: string;
  component: string;
  category: string;
  subCategory: string;
  value: number;
  baseline: number;
  status: string;
  buildUrl: string;
  chirality: number;
  threshold?: number | null;
}

interface WeeklyComponentDetail {
  component: string;
  metrics: WeeklyMetricResult[];
}

interface WeeklyDetailResponse {
  build: string;
  date: string;
  components: WeeklyComponentDetail[];
}

// ── Module-level caches ───────────────────────────────────────────────────────
//
// These survive component remounts caused by drilldown navigation between builds.
// Navigating to a pre-fetched or previously-visited build is instant — no loading flash.

let cachedBuilds: WeeklyBuildEntry[] | null = null;
const detailCache = new Map<string, WeeklyDetailResponse>();

function prefetchBuild(build: string): void {
  if (detailCache.has(build)) {
    return;
  }
  getBackendSrv()
    .get<WeeklyDetailResponse>(`${API_BASE_URL}/weekly/detail`, { build })
    .then((resp) => {
      detailCache.set(build, resp);
    })
    .catch(() => {}); // background hint — silently ignore failures
}

// ── URL helpers ───────────────────────────────────────────────────────────────

export function weeklyBuildUrl(build: string): string {
  return prefixRoute(`${ROUTES.Weekly}/${encodeURIComponent(build)}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: string, theme: ReturnType<typeof useTheme2>) {
  switch (status) {
    case 'regressed':
      return theme.colors.error.text;
    case 'warning':
      return theme.colors.warning.text;
    case 'passed':
      return theme.colors.success.text;
    default:
      return theme.colors.text.disabled;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'regressed':
      return 'Regressed';
    case 'warning':
      return 'Warning';
    case 'passed':
      return 'Passed';
    default:
      return 'Neutral';
  }
}

function formatValue(value: number): string {
  if (value === 0) {
    return '0';
  }
  if (Math.abs(value) >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + 'M';
  }
  if (Math.abs(value) >= 1_000) {
    return (value / 1_000).toFixed(2) + 'K';
  }
  return value.toFixed(2);
}

// ── Inline metric timeline ────────────────────────────────────────────────────

async function fetchSingleMetricPanel(
  metricId: string,
  majorMinor: string | null,
  showHidden: boolean
): Promise<TimelinePanel | null> {
  const params = new URLSearchParams();
  if (majorMinor) {
    params.set('serverMajorMinor', majorMinor);
  }
  if (showHidden) {
    params.set('showHiddenBenchmarks', 'true');
  }
  const qs = params.toString();
  const url = `${API_BASE_URL}/timelines/panel/${encodeURIComponent(metricId)}${qs ? '?' + qs : ''}`;
  return getBackendSrv().get<TimelinePanel | null>(url);
}

function extractMajorMinor(build: string): string {
  const m = build.match(/^(\d+\.\d+)/);
  return m ? m[1] : '';
}

function MetricChart({ panel }: { panel: TimelinePanel }) {
  const scene = useMemo(
    () =>
      new EmbeddedScene({
        body: new SceneFlexLayout({
          direction: 'column',
          children: [buildBarChartPanelItem(panel)],
        }),
      }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div style={{ height: 380, display: 'flex', flexDirection: 'column' }}>
      <scene.Component model={scene} />
    </div>
  );
}

function MetricTimeline({ metricId, currentBuild }: { metricId: string; currentBuild: string }) {
  const theme = useTheme2();
  const currentMajorMinor = extractMajorMinor(currentBuild);
  const [focusCurrent, setFocusCurrent] = useState(false);
  const [panel, setPanel] = useState<TimelinePanel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    const mm = focusCurrent && currentMajorMinor ? currentMajorMinor : null;
    fetchSingleMetricPanel(metricId, mm, focusCurrent)
      .then((p) => {
        if (!active) {
          return;
        }
        setPanel(p);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [metricId, focusCurrent, currentMajorMinor]);

  return (
    <div
      style={{
        padding: theme.spacing(2),
        background: theme.colors.background.canvas,
        borderTop: `1px solid ${theme.colors.border.weak}`,
      }}
    >
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: theme.spacing(0.75),
          fontSize: 12,
          color: theme.colors.text.secondary,
          cursor: 'pointer',
          marginBottom: theme.spacing(1.5),
        }}
      >
        <input type="checkbox" checked={focusCurrent} onChange={(e) => setFocusCurrent(e.target.checked)} />
        {currentMajorMinor ? `Focus on ${currentMajorMinor} · include hidden` : 'Include hidden benchmarks'}
      </label>

      {loading && <LoadingPlaceholder text="Loading timeline…" />}
      {error && (
        <div style={{ color: theme.colors.error.text, fontSize: 13 }}>Failed to load timeline data.</div>
      )}
      {!loading && !error && !panel && (
        <div style={{ color: theme.colors.text.secondary, fontSize: 13 }}>No benchmark data found.</div>
      )}
      {!loading && !error && panel && (
        <MetricChart key={`${panel.metricId}-${focusCurrent}`} panel={panel} />
      )}
    </div>
  );
}

// ── Component section ─────────────────────────────────────────────────────────

function ComponentSection({
  detail,
  currentBuild,
  theme,
}: {
  detail: WeeklyComponentDetail;
  currentBuild: string;
  theme: ReturnType<typeof useTheme2>;
}) {
  const [expandedMetricId, setExpandedMetricId] = useState<string | null>(null);

  const hasRegression = detail.metrics.some((m) => m.status === 'regressed');
  const hasWarning = detail.metrics.some((m) => m.status === 'warning');
  const headerColor = hasRegression
    ? theme.colors.error.text
    : hasWarning
    ? theme.colors.warning.text
    : theme.colors.success.text;

  const cellStyle: React.CSSProperties = {
    padding: `${theme.spacing(0.75)} ${theme.spacing(1.5)}`,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    fontSize: 13,
    verticalAlign: 'middle',
  };

  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    color: theme.colors.text.secondary,
    background: theme.colors.background.canvas,
  };

  const actionLinkStyle: React.CSSProperties = {
    fontSize: 12,
    color: theme.colors.text.link,
    textDecoration: 'none',
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    padding: `2px ${theme.spacing(0.75)}`,
    whiteSpace: 'nowrap',
    background: 'none',
    cursor: 'pointer',
  };

  return (
    <div style={{ marginBottom: theme.spacing(3) }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: headerColor,
          marginBottom: theme.spacing(1),
          paddingLeft: theme.spacing(0.5),
        }}
      >
        {detail.component}
        <span
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: theme.colors.text.secondary,
            marginLeft: theme.spacing(1),
          }}
        >
          {detail.metrics.length} metric{detail.metrics.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        style={{
          overflowX: 'auto',
          borderRadius: theme.shape.radius.default,
          border: `1px solid ${theme.colors.border.weak}`,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...headerCellStyle, width: 90 }}>Status</th>
              <th style={headerCellStyle}>Metric</th>
              <th style={{ ...headerCellStyle, width: 80 }}>Category</th>
              <th style={{ ...headerCellStyle, width: 100, textAlign: 'right' }}>Value</th>
              <th style={{ ...headerCellStyle, width: 100, textAlign: 'right' }}>Baseline</th>
              <th style={{ ...headerCellStyle, width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {detail.metrics.map((m) => {
              const color = statusColor(m.status, theme);
              const isExpanded = expandedMetricId === m.metricId;
              return (
                <React.Fragment key={m.metricId}>
                  <tr>
                    <td style={cellStyle}>
                      <span style={{ color, fontWeight: 600, fontSize: 12 }}>{statusLabel(m.status)}</span>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 500 }}>{m.title}</div>
                      {m.subCategory && (
                        <div style={{ fontSize: 11, color: theme.colors.text.secondary }}>{m.subCategory}</div>
                      )}
                    </td>
                    <td style={{ ...cellStyle, color: theme.colors.text.secondary, fontSize: 12 }}>{m.category}</td>
                    <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color }}>
                      {formatValue(m.value)}
                    </td>
                    <td
                      style={{
                        ...cellStyle,
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        color: theme.colors.text.secondary,
                      }}
                    >
                      {m.baseline > 0 ? formatValue(m.baseline) : '—'}
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', gap: theme.spacing(0.75), flexWrap: 'wrap' }}>
                        {m.buildUrl && (
                          <a
                            href={m.buildUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={actionLinkStyle}
                          >
                            Jenkins
                          </a>
                        )}
                        <button
                          onClick={() => setExpandedMetricId(isExpanded ? null : m.metricId)}
                          style={{
                            ...actionLinkStyle,
                            color: isExpanded ? theme.colors.text.primary : theme.colors.text.link,
                            fontWeight: isExpanded ? 600 : 400,
                          }}
                        >
                          {isExpanded ? 'Close' : 'View'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0 }}>
                        <MetricTimeline metricId={m.metricId} currentBuild={currentBuild} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page content ─────────────────────────────────────────────────────────

function WeeklyContent({ initialBuild }: { initialBuild?: string }) {
  const theme = useTheme2();


  // Initialise from module-level cache so that returning to a build or navigating to
  // a pre-fetched build shows content immediately without a loading flash.
  const [builds, setBuilds] = useState<WeeklyBuildEntry[]>(cachedBuilds ?? []);
  const [buildsLoading, setBuildsLoading] = useState(cachedBuilds === null);

  const [detail, setDetail] = useState<WeeklyDetailResponse | null>(
    initialBuild ? (detailCache.get(initialBuild) ?? null) : null
  );
  const [detailLoading, setDetailLoading] = useState(
    initialBuild !== undefined && !detailCache.has(initialBuild)
  );
  const [detailError, setDetailError] = useState(false);

  // Fetch the builds list once; redirect to most recent when landing on /weekly with no build.
  useEffect(() => {
    if (cachedBuilds !== null) {
      if (!initialBuild && cachedBuilds.length > 0) {
        locationService.push(weeklyBuildUrl(cachedBuilds[0].build));
      }
      return;
    }
    getBackendSrv()
      .get<{ builds: WeeklyBuildEntry[] }>(`${API_BASE_URL}/weekly/builds`)
      .then((resp) => {
        const list = resp.builds ?? [];
        cachedBuilds = list;
        setBuilds(list);
        setBuildsLoading(false);
        if (!initialBuild && list.length > 0) {
          locationService.push(weeklyBuildUrl(list[0].build));
        }
      })
      .catch(() => setBuildsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch detail for the current build; skip if already cached.
  // After loading, kick off background pre-fetches for the two adjacent builds.
  useEffect(() => {
    if (!initialBuild) {
      return;
    }
    const cached = detailCache.get(initialBuild);
    if (cached) {
      setDetail(cached);
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    setDetailError(false);
    setDetail(null);
    getBackendSrv()
      .get<WeeklyDetailResponse>(`${API_BASE_URL}/weekly/detail`, { build: initialBuild })
      .then((resp) => {
        detailCache.set(initialBuild, resp);
        setDetail(resp);
        setDetailLoading(false);

        // Pre-fetch neighbours so the next < > click is instant.
        const all = cachedBuilds ?? builds;
        const idx = all.findIndex((b) => b.build === initialBuild);
        if (idx > 0) {
          prefetchBuild(all[idx - 1].build); // newer (lower index)
        }
        if (idx >= 0 && idx < all.length - 1) {
          prefetchBuild(all[idx + 1].build); // older (higher index)
        }
      })
      .catch(() => {
        setDetailError(true);
        setDetailLoading(false);
      });
  }, [initialBuild]); // eslint-disable-line react-hooks/exhaustive-deps

  function navigate(idx: number) {
    const b = (cachedBuilds ?? builds)[idx];
    if (b) {
      locationService.push(weeklyBuildUrl(b.build));
    }
  }

  // ── Guards ───────────────────────────────────────────────────────────────────

  if (!initialBuild) {
    return (
      <div style={{ padding: theme.spacing(4) }}>
        <LoadingPlaceholder text="Loading weekly builds…" />
      </div>
    );
  }

  const allBuilds = cachedBuilds ?? builds;
  const buildIndex = allBuilds.findIndex((b) => b.build === initialBuild);
  const currentBuild: WeeklyBuildEntry = allBuilds[buildIndex] ?? { build: initialBuild, date: '', active: false };

  const totalRegressed =
    detail?.components.reduce((sum, c) => sum + c.metrics.filter((m) => m.status === 'regressed').length, 0) ?? 0;
  const totalWarning =
    detail?.components.reduce((sum, c) => sum + c.metrics.filter((m) => m.status === 'warning').length, 0) ?? 0;
  const totalPassed =
    detail?.components.reduce((sum, c) => sum + c.metrics.filter((m) => m.status === 'passed').length, 0) ?? 0;

  const canGoOlder = !buildsLoading && buildIndex >= 0 && buildIndex < allBuilds.length - 1;
  const canGoNewer = !buildsLoading && buildIndex > 0;

  return (
    <div style={{ padding: theme.spacing(3), color: theme.colors.text.primary }}>
      {/* Navigation header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing(2),
          marginBottom: theme.spacing(3),
          paddingBottom: theme.spacing(2),
          borderBottom: `1px solid ${theme.colors.border.weak}`,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing(1) }}>
          <LinkButton
            variant="secondary"
            icon="angle-left"
            disabled={!canGoOlder}
            onClick={() => navigate(buildIndex + 1)}
            tooltip="Older build"
          />
          <div style={{ minWidth: 260, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'monospace' }}>{currentBuild.build}</div>
            {currentBuild.date && (
              <div style={{ fontSize: 12, color: theme.colors.text.secondary }}>{currentBuild.date}</div>
            )}
          </div>
          <LinkButton
            variant="secondary"
            icon="angle-right"
            disabled={!canGoNewer}
            onClick={() => navigate(buildIndex - 1)}
            tooltip="Newer build"
          />
        </div>

        {detail && !detailLoading && (
          <div style={{ display: 'flex', gap: theme.spacing(2), flexWrap: 'wrap' }}>
            {totalRegressed > 0 && (
              <span style={{ fontSize: 13, color: theme.colors.error.text, fontWeight: 600 }}>
                ✗ {totalRegressed} regressed
              </span>
            )}
            {totalWarning > 0 && (
              <span style={{ fontSize: 13, color: theme.colors.warning.text, fontWeight: 600 }}>
                ⚠ {totalWarning} warning
              </span>
            )}
            {totalPassed > 0 && (
              <span style={{ fontSize: 13, color: theme.colors.success.text }}>✓ {totalPassed} passed</span>
            )}
          </div>
        )}

        {currentBuild.active && (
          <span
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: theme.colors.success.text,
              border: `1px solid ${theme.colors.success.border}`,
              borderRadius: theme.shape.radius.pill,
              padding: `2px ${theme.spacing(1)}`,
            }}
          >
            Active
          </span>
        )}
      </div>

      {/* Detail content */}
      {detailLoading && (
        <div style={{ padding: theme.spacing(4) }}>
          <LoadingPlaceholder text="Loading metrics…" />
        </div>
      )}

      {detailError && (
        <div style={{ color: theme.colors.error.text, padding: theme.spacing(2) }}>
          Failed to load detail for this build.
        </div>
      )}

      {detail && !detailLoading && detail.components.length === 0 && (
        <div style={{ color: theme.colors.text.secondary, padding: theme.spacing(2) }}>
          No completed benchmark runs found for this build.
        </div>
      )}

      {detail &&
        !detailLoading &&
        detail.components.map((c) => (
          <ComponentSection key={c.component} detail={c} currentBuild={initialBuild ?? ''} theme={theme} />
        ))}
    </div>
  );
}

// ── Scene export ──────────────────────────────────────────────────────────────

export function weeklyScene(build?: string) {
  return new EmbeddedScene({
    body: new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          body: new SceneReactObject({ reactNode: <WeeklyContent initialBuild={build} /> }),
        }),
      ],
    }),
  });
}
