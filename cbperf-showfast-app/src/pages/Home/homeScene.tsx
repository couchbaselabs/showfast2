import React, { useCallback, useEffect, useState } from 'react';
import { EmbeddedScene, SceneFlexItem, SceneFlexLayout, SceneReactObject } from '@grafana/scenes';
import { LoadingPlaceholder, Stack, Tab, TabsBar, useTheme2 } from '@grafana/ui';
import { fetchSummaryEndpoint } from './summaryDashboardData';
import { ComponentCard } from './ComponentCard';
import { JenkinsRun, JenkinsRunsResponse, PipelineSummary, PipelineSummaryResponse } from './homeApiTypes';
import { weeklyBuildUrl } from '../Weekly/weeklyScene';

type TabId = 'today' | 'week' | 'jenkins';

function PipelineSection({
  pipeline,
  theme,
  weeklyHref,
}: {
  pipeline: PipelineSummary;
  theme: ReturnType<typeof useTheme2>;
  weeklyHref?: string;
}) {
  return (
    <div style={{ marginBottom: theme.spacing(3) }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: theme.spacing(1.5),
          marginBottom: theme.spacing(1.5),
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{pipeline.build}</span>
        <span
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: theme.colors.text.secondary,
            padding: `2px ${theme.spacing(0.75)}`,
            border: `1px solid ${theme.colors.border.medium}`,
            borderRadius: theme.shape.radius.pill,
          }}
        >
          {pipeline.type}
        </span>
        <span style={{ fontSize: 12, color: theme.colors.text.secondary }}>{pipeline.date}</span>
        {weeklyHref && (
          <a
            href={weeklyHref}
            style={{
              fontSize: 12,
              color: theme.colors.text.link,
              textDecoration: 'none',
              marginLeft: 'auto',
            }}
          >
            View in Weekly →
          </a>
        )}
      </div>
      {pipeline.components.length === 0 ? (
        <div style={{ fontSize: 13, color: theme.colors.text.secondary }}>No completed runs yet.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1.5) }}>
          {pipeline.components.map((cs) => (
            <ComponentCard key={cs.component} status={cs} />
          ))}
        </div>
      )}
    </div>
  );
}

function PipelineTab({
  endpoint,
  emptyMessage,
  getWeeklyHref,
}: {
  endpoint: string;
  emptyMessage: string;
  getWeeklyHref?: (pipeline: PipelineSummary) => string;
}) {
  const theme = useTheme2();
  const [data, setData] = useState<PipelineSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetchSummaryEndpoint<PipelineSummaryResponse>(endpoint)
      .then((resp) => {
        setData(resp.pipelines ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [endpoint]);

  if (loading) {
    return (
      <div style={{ padding: theme.spacing(4) }}>
        <LoadingPlaceholder text="Loading…" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: theme.spacing(4), color: theme.colors.error.text }}>
        Failed to load pipeline data.
      </div>
    );
  }

  const pipelines = data ?? [];

  if (pipelines.length === 0) {
    return (
      <div style={{ padding: theme.spacing(4), color: theme.colors.text.secondary }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ paddingTop: theme.spacing(3) }}>
      {pipelines.map((p) => (
        <PipelineSection
          key={p.build}
          pipeline={p}
          theme={theme}
          weeklyHref={getWeeklyHref ? getWeeklyHref(p) : undefined}
        />
      ))}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms <= 0) {
    return '—';
  }
  const s = Math.round(ms / 1000);
  if (s < 60) {
    return `${s}s`;
  }
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) {
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  }
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

function JenkinsTab() {
  const theme = useTheme2();
  const [data, setData] = useState<JenkinsRun[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetchSummaryEndpoint<JenkinsRunsResponse>('jenkins-runs')
      .then((resp) => {
        setData(resp.runs ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: theme.spacing(4) }}>
        <LoadingPlaceholder text="Loading…" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: theme.spacing(4), color: theme.colors.error.text }}>
        Failed to load Jenkins runs.
      </div>
    );
  }

  const runs = data ?? [];

  if (runs.length === 0) {
    return (
      <div style={{ padding: theme.spacing(4), color: theme.colors.text.secondary }}>
        No Jenkins runs found.
      </div>
    );
  }

  const cellStyle: React.CSSProperties = {
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    fontSize: 13,
    verticalAlign: 'middle',
  };

  const headerStyle: React.CSSProperties = {
    ...cellStyle,
    fontWeight: 600,
    color: theme.colors.text.secondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  };

  return (
    <div style={{ overflowX: 'auto', marginTop: theme.spacing(2) }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={headerStyle}>Component</th>
            <th style={headerStyle}>Job</th>
            <th style={headerStyle}>Version</th>
            <th style={headerStyle}>Status</th>
            <th style={headerStyle}>Duration</th>
            <th style={headerStyle}>Time</th>
            <th style={headerStyle}>Link</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run, i) => (
            <tr key={i}>
              <td style={cellStyle}>{run.component}</td>
              <td style={cellStyle}>{run.job}</td>
              <td style={{ ...cellStyle, fontFamily: 'monospace' }}>{run.version}</td>
              <td style={cellStyle}>
                {run.success ? (
                  <span style={{ color: theme.colors.success.text, fontWeight: 600 }}>✓ passed</span>
                ) : (
                  <span style={{ color: theme.colors.error.text, fontWeight: 600 }}>✗ failed</span>
                )}
              </td>
              <td style={cellStyle}>{formatDuration(run.duration)}</td>
              <td style={{ ...cellStyle, color: theme.colors.text.secondary }}>
                {run.timestamp > 0 ? new Date(run.timestamp).toLocaleString() : '—'}
              </td>
              <td style={cellStyle}>
                {run.url ? (
                  <a href={run.url} target="_blank" rel="noreferrer" style={{ color: theme.colors.text.link }}>
                    Open
                  </a>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_KEYS = [
  {
    color: 'success' as const,
    label: 'Passed',
    description: 'Value within the yellow threshold of the 30-day baseline median.',
  },
  {
    color: 'warning' as const,
    label: 'Warning',
    description: 'Value between the yellow and red thresholds — mild regression.',
  },
  {
    color: 'error' as const,
    label: 'Regressed',
    description: 'Value beyond the red threshold — significant regression.',
  },
  {
    color: 'secondary' as const,
    label: 'Neutral',
    description: 'Metric has no performance direction (chirality = 0) or insufficient history.',
  },
];

function StatusKey() {
  const theme = useTheme2();

  const dotColor: Record<string, string> = {
    success: theme.colors.success.text,
    warning: theme.colors.warning.text,
    error: theme.colors.error.text,
    secondary: theme.colors.text.disabled,
  };

  return (
    <div
      style={{
        padding: theme.spacing(2, 3),
        borderRadius: theme.shape.radius.default,
        border: `1px solid ${theme.colors.border.weak}`,
        background: theme.colors.background.canvas,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: theme.colors.text.secondary, marginBottom: theme.spacing(1.5) }}>
        Status key
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing(3) }}>
        {STATUS_KEYS.map(({ color, label, description }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: theme.spacing(1), minWidth: 200, flex: '1 1 200px' }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: dotColor[color],
                flexShrink: 0,
                marginTop: 3,
              }}
            />
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: dotColor[color] }}>{label}</span>
              <span style={{ fontSize: 12, color: theme.colors.text.secondary }}> — {description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingContent() {
  const theme = useTheme2();
  const [activeTab, setActiveTab] = useState<TabId>('week');

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
  }, []);

  return (
    <div
      style={{
        padding: theme.spacing(4),
        color: theme.colors.text.primary,
        minHeight: 'calc(100vh - 160px)',
      }}
    >
      <Stack direction="column" gap={4}>
        <div>
          <div
            style={{
              padding: theme.spacing(3),
              borderRadius: theme.shape.radius.default,
              border: `1px solid ${theme.colors.border.weak}`,
              background: theme.colors.background.primary,
            }}
          >
            <TabsBar>
              <Tab
                label="This week"
                tooltip="Summary of active weekly pipelines"
                active={activeTab === 'week'}
                onChangeTab={() => handleTabChange('week')}
              />
              <Tab
                label="Today"
                tooltip="Summary of active daily pipelines"
                active={activeTab === 'today'}
                onChangeTab={() => handleTabChange('today')}
              />
              <Tab
                label="Jenkins"
                tooltip="Summary of Jenkins runs"
                active={activeTab === 'jenkins'}
                onChangeTab={() => handleTabChange('jenkins')}
              />
            </TabsBar>

            {activeTab === 'today' && (
              <PipelineTab
                endpoint="daily-component-status"
                emptyMessage="No active daily pipelines."
              />
            )}
            {activeTab === 'week' && (
              <PipelineTab
                endpoint="weekly-component-status"
                emptyMessage="No active weekly pipelines."
                getWeeklyHref={(p) => weeklyBuildUrl(p.build)}
              />
            )}
            {activeTab === 'jenkins' && <JenkinsTab />}
          </div>
        </div>

        <StatusKey />
      </Stack>
    </div>
  );
}

export function homeScene() {
  return new EmbeddedScene({
    body: new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          body: new SceneReactObject({ reactNode: <LandingContent /> }),
        }),
      ],
    }),
  });
}
