import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, Drawer, Spinner, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import {
  RunDetail,
  RunSummary,
  formatSnapshotUrl,
  formatDetailDate,
} from './detailService';

interface Props {
  detail: RunDetail | null;
  loading: boolean;
  runId: string;
  metricId: string;
  onClose: () => void;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    body: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      padding: theme.spacing(2),
      paddingTop: theme.spacing(1),
    }),
    metaRow: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 0),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    badge: css({
      display: 'inline-block',
      padding: theme.spacing(0.25, 0.75),
      borderRadius: theme.shape.radius.pill,
      fontSize: 11,
      fontWeight: theme.typography.fontWeightMedium,
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.medium}`,
      color: theme.colors.text.secondary,
    }),
    badgePrimary: css({
      backgroundColor: theme.colors.primary.transparent,
      borderColor: theme.colors.primary.border,
      color: theme.colors.primary.text,
    }),
    metaDot: css({
      color: theme.colors.text.disabled,
    }),
    metaText: css({
      fontSize: 12,
      color: theme.colors.text.secondary,
    }),
    valueCard: css({
      display: 'flex',
      alignItems: 'baseline',
      gap: theme.spacing(1.5),
      padding: theme.spacing(1.5, 2),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    valueNumber: css({
      fontSize: 28,
      fontWeight: theme.typography.fontWeightBold,
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamilyMonospace,
      lineHeight: 1,
    }),
    chiralityUp: css({
      fontSize: 12,
      color: theme.colors.success.text,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    chiralityDown: css({
      fontSize: 12,
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    chiralityNeutral: css({
      fontSize: 12,
      color: theme.colors.text.disabled,
    }),
    section: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
    }),
    sectionTitle: css({
      fontSize: 11,
      fontWeight: theme.typography.fontWeightBold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: theme.colors.text.secondary,
      paddingBottom: theme.spacing(0.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    detailRow: css({
      display: 'grid',
      gridTemplateColumns: '100px 1fr',
      gap: theme.spacing(0.5, 1.5),
      alignItems: 'start',
    }),
    detailLabel: css({
      fontSize: 12,
      color: theme.colors.text.disabled,
      paddingTop: 1,
    }),
    detailValue: css({
      fontSize: 13,
      color: theme.colors.text.primary,
      wordBreak: 'break-word',
    }),
    detailValueMono: css({
      fontSize: 12,
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamilyMonospace,
      wordBreak: 'break-all',
    }),
    detailValueSecondary: css({
      fontSize: 12,
      color: theme.colors.text.secondary,
      wordBreak: 'break-word',
    }),
    tagsRow: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
    }),
    tagBadge: css({
      fontSize: 11,
      padding: theme.spacing(0.2, 0.6),
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      color: theme.colors.text.secondary,
    }),
    linksRow: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    }),
    spinnerCenter: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing(4),
    }),
    rerunTable: css({
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }),
    rerunRow: css({
      display: 'grid',
      gridTemplateColumns: '20px 1fr auto auto',
      gap: theme.spacing(0, 1),
      alignItems: 'center',
      padding: theme.spacing(0.6, 0.75),
      borderRadius: theme.shape.radius.default,
      border: `1px solid transparent`,
    }),
    rerunRowSelected: css({
      backgroundColor: theme.colors.action.selected,
      border: `1px solid ${theme.colors.primary.border}`,
    }),
    rerunIndex: css({
      fontSize: 11,
      color: theme.colors.text.disabled,
      textAlign: 'right',
    }),
    rerunInfo: css({
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      minWidth: 0,
    }),
    rerunDate: css({
      fontSize: 12,
      color: theme.colors.text.primary,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    hiddenBadge: css({
      fontSize: 10,
      padding: '0 4px',
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.warning.transparent,
      border: `1px solid ${theme.colors.warning.border}`,
      color: theme.colors.warning.text,
      lineHeight: '16px',
    }),
    rerunValue: css({
      fontSize: 11,
      color: theme.colors.text.secondary,
      fontFamily: theme.typography.fontFamilyMonospace,
    }),
    rerunLinks: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      alignItems: 'center',
      flexShrink: 0,
    }),
    rerunLinkBtn: css({
      padding: `2px ${theme.spacing(0.75)}`,
      fontSize: 11,
      lineHeight: 1.4,
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      fontFamily: theme.typography.fontFamilyMonospace,
      '&:hover': {
        backgroundColor: theme.colors.action.hover,
        color: theme.colors.text.primary,
      },
    }),
  };
}

function DetailRow({ label, value, mono, secondary }: {
  label: string;
  value: string | number;
  mono?: boolean;
  secondary?: boolean;
}) {
  const styles = useStyles2(getStyles);
  if (!value && value !== 0) {
    return null;
  }
  const valueClass = mono ? styles.detailValueMono : secondary ? styles.detailValueSecondary : styles.detailValue;
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function RerunRow({
  run,
  index,
  selected,
}: {
  run: RunSummary;
  index: number;
  selected: boolean;
}) {
  const styles = useStyles2(getStyles);
  const snapshots = (run.snapshots ?? []).filter(Boolean);

  return (
    <div className={`${styles.rerunRow}${selected ? ` ${styles.rerunRowSelected}` : ''}`}>
      <span className={styles.rerunIndex}>{index + 1}</span>
      <div className={styles.rerunInfo}>
        <span className={styles.rerunDate}>
          {formatDetailDate(run.dateTime)}
          {run.hidden && <span className={styles.hiddenBadge}>hidden</span>}
        </span>
        <span className={styles.rerunValue}>{run.value}</span>
      </div>
      <div className={styles.rerunLinks}>
        {run.buildUrl && (
          <button
            className={styles.rerunLinkBtn}
            title="Jenkins build"
            onClick={() => window.open(run.buildUrl, '_blank')}
          >
            J
          </button>
        )}
        {snapshots.map((s, si) => (
          <button
            key={s}
            className={styles.rerunLinkBtn}
            title={`CBMonitor snapshot ${si + 1}`}
            onClick={() => window.open(formatSnapshotUrl(s), '_blank')}
          >
            C{si + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BenchmarkDetailDrawer({ detail, loading, runId, metricId, onClose }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <Drawer title={`Benchmark Detail for build ${detail?.benchmark.build ?? ''}`} onClose={onClose} size="sm">
      {loading && (
        <div className={styles.spinnerCenter}>
          <Spinner size="xl" />
        </div>
      )}

      {!loading && detail && (
        <div className={styles.body}>
          {/* Meta strip */}
          <div className={styles.metaRow}>
            <span className={`${styles.badge} ${styles.badgePrimary}`}>{detail.benchmark.build}</span>
            {detail.benchmark.pipelineGroup && (
              <span className={styles.badge}>{detail.benchmark.pipelineGroup}</span>
            )}
            <span className={styles.metaDot}>·</span>
            <span className={styles.metaText}>{formatDetailDate(detail.benchmark.dateTime)}</span>
            {detail.benchmark.os && (
              <>
                <span className={styles.metaDot}>·</span>
                <span className={styles.metaText}>{detail.benchmark.os}</span>
              </>
            )}
          </div>

          {/* Value card */}
          <div className={styles.valueCard}>
            <span className={styles.valueNumber}>{detail.benchmark.value}</span>
            {detail.metric.chirality === 1 && (
              <span className={styles.chiralityUp}>↑ higher is better</span>
            )}
            {detail.metric.chirality === -1 && (
              <span className={styles.chiralityDown}>↓ lower is better</span>
            )}
            {detail.metric.chirality === 0 && (
              <span className={styles.chiralityNeutral}>↔ neutral</span>
            )}
          </div>

          {/* Links for the selected run */}
          <div className={styles.linksRow}>
            {detail.run.buildUrl && (
              <Button
                variant="secondary"
                size="sm"
                icon="external-link-alt"
                onClick={() => window.open(detail.run.buildUrl, '_blank')}
              >
                Jenkins Build
              </Button>
            )}
            {(detail.benchmark.snapshots ?? []).filter(Boolean).map((s, i) => (
              <Button
                key={s}
                variant="secondary"
                size="sm"
                icon="external-link-alt"
                onClick={() => window.open(formatSnapshotUrl(s), '_blank')}
              >
                CBMonitor {i + 1}
              </Button>
            ))}
          </div>

          {/* Metric */}
          <Section title="Metric">
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Title</span>
              <span className={styles.detailValueSecondary}>{detail.metric.title}</span>
            </div>
            <DetailRow label="Component" value={detail.metric.component} />
            <DetailRow
              label="Category"
              value={detail.metric.subCategory
                ? `${detail.metric.category} / ${detail.metric.subCategory}`
                : detail.metric.category}
            />
            {detail.metric.provider && (
              <DetailRow label="Provider" value={detail.metric.provider} />
            )}
            {detail.metric.memquota > 0 && (
              <DetailRow label="Mem quota" value={`${detail.metric.memquota.toLocaleString()} MB`} />
            )}
          </Section>

          {/* Test */}
          <Section title="Test">
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Description</span>
              <span className={styles.detailValueSecondary}>{detail.test.title}</span>
            </div>
            {detail.test.testConfig && (
              <DetailRow label="Config" value={detail.test.testConfig} mono />
            )}
            {detail.test.threshold != null && (
              <DetailRow label="Threshold" value={`${detail.test.threshold}%`} />
            )}
            {detail.test.tags && Object.keys(detail.test.tags).length > 0 && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Tags</span>
                <div className={styles.tagsRow}>
                  {Object.entries(detail.test.tags).map(([k, v]) => (
                    <span key={k} className={styles.tagBadge}>
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Infrastructure */}
          <Section title="Infrastructure">
            <DetailRow label="Cluster" value={detail.cluster.name} mono />
            <DetailRow label="OS" value={detail.cluster.os} />
            {detail.cluster.cpu && (
              <DetailRow label="CPU" value={detail.cluster.cpu} secondary />
            )}
            {detail.cluster.memory && (
              <DetailRow label="Memory" value={detail.cluster.memory} secondary />
            )}
            {detail.cluster.disk && (
              <DetailRow label="Disk" value={detail.cluster.disk} secondary />
            )}
            {detail.cluster.provider && (
              <DetailRow label="Provider" value={detail.cluster.provider} />
            )}
          </Section>

          {/* Build */}
          <Section title="Build">
            <DetailRow label="Version" value={detail.build.version} mono />
            <DetailRow label="Series" value={detail.build.majorMinor} />
            {detail.build.buildType && (
              <DetailRow label="Type" value={detail.build.buildType} />
            )}
            {detail.run.versions.sdk && (
              <DetailRow label="SDK" value={detail.run.versions.sdk} mono />
            )}
            {detail.run.versions.tls && (
              <DetailRow label="TLS" value={detail.run.versions.tls} />
            )}
            {detail.run.versions.capella && (
              <DetailRow label="Capella" value={detail.run.versions.capella} mono />
            )}
            {detail.run.versions.aiGateway && (
              <DetailRow label="AI Gateway" value={detail.run.versions.aiGateway} mono />
            )}
          </Section>

          {/* Chirality & Thresholds diagnostics */}
          <Section title="Chirality & Thresholds">
            {(() => {
              const chirality = detail.metric.chirality ?? 0;
              const threshold = detail.test.threshold;
              if (chirality === 0) {
                return (
                  <>
                    <DetailRow label="Active" value="no — neutral metric, no regression direction" />
                    <DetailRow label="Chirality" value="0" mono />
                  </>
                );
              }
              const yellowPct = threshold ?? 5;
              const redPct = threshold != null ? threshold * 2 : 10;
              const direction = chirality === -1
                ? 'lower is better - high bars = regression (red)'
                : 'higher is better - low bars = regression (red)';
              const mode = threshold != null
                ? `threshold-based (${threshold}% from DB)`
                : 'median-based (no DB threshold set)';
              return (
                <>
                  <DetailRow label="Active" value="yes" />
                  <DetailRow label="Chirality" value={String(chirality)} mono />
                  <DetailRow label="Direction" value={direction} />
                  <DetailRow label="Mode" value={mode} />
                  <DetailRow label="Yellow at" value={`±${yellowPct}% from median`} />
                  <DetailRow label="Red at" value={`±${redPct}% from median`} />
                </>
              );
            })()}
          </Section>

          {/* All reruns grouped by build */}
          {detail.reruns && detail.reruns.length > 1 && (
            <Section title={`All runs for ${detail.benchmark.build} (${detail.reruns.length})`}>
              <div className={styles.rerunTable}>
                {detail.reruns.map((r, i) => (
                  <RerunRow
                    key={r.runId}
                    run={r}
                    index={i}
                    selected={r.runId === detail.benchmark.runId}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Debug metadata — Couchbase document keys */}
          <Section title="Debug Metadata">
            <DetailRow label="run id" value={runId} mono />
            <DetailRow label="metric id" value={metricId} mono />
            {detail.test.testConfig && (
              <DetailRow label="test config" value={detail.test.testConfig} mono />
            )}
          </Section>
        </div>
      )}
    </Drawer>
  );
}
