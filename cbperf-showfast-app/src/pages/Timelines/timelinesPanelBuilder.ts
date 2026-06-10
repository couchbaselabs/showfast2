import { DataFrame, Field, FieldType, LoadingState, PanelData, dateTime } from '@grafana/data';
import { PanelBuilders, SceneDataNode, SceneFlexItem } from '@grafana/scenes';
import { VizOrientation, VisibilityMode } from '@grafana/schema';
import { TimelinePanel } from './timelinesApiTypes';

function clusterSubtitle(panel: TimelinePanel): string {
  if (!panel.clusterInfo) {
    return panel.cluster;
  }
  const c = panel.clusterInfo;
  return [c.name, c.os, c.cpu, c.memory, c.disk].filter(Boolean).join('  ·  ');
}

function formatSnapshotReportUrl(snapshotId: string): string {
  if (snapshotId.includes('_')) {
    return `http://cbmonitor.sc.couchbase.com/reports/html/?snapshot=${encodeURIComponent(snapshotId)}`;
  }

  return `https://cbmonitor2.sc.couchbase.com/a/cbmonitor/snapshots/${encodeURIComponent(snapshotId)}`;
}

function dynamicBarWidth(barCount: number): number {
  // Keep bars readable for dense panels while allowing fuller bars for sparse panels.
  if (barCount <= 8) {
    return 0.85;
  }
  if (barCount <= 16) {
    return 0.75;
  }
  if (barCount <= 28) {
    return 0.65;
  }
  if (barCount <= 40) {
    return 0.55;
  }
  return 0.45;
}

export function buildBarChartPanelItem(panel: TimelinePanel): SceneFlexItem {
  const points = panel.benchmarksValues ?? [];
  const barWidth = dynamicBarWidth(points.length);
  const snapshotIds = points.map((p) => (p.snapshots ?? []).filter((value) => value.length > 0));
  const maxSnapshotCount = snapshotIds.reduce((maxCount, ids) => Math.max(maxCount, ids.length), 0);
  const snapshotLinks = Array.from({ length: maxSnapshotCount }, (_, index) => ({
    title: `${index + 1}`,
    url: `\${__data.fields.snapshotReportUrl${index + 1}}`,
    targetBlank: true,
  }));
  const snapshotUrlFields: Field[] = Array.from({ length: maxSnapshotCount }, (_, index) => ({
    name: `snapshotReportUrl${index + 1}`,
    type: FieldType.string,
    config: {},
    values: snapshotIds.map((ids) => (ids[index] ? formatSnapshotReportUrl(ids[index]) : '')),
  }));

  const frame: DataFrame = {
    name: panel.title,
    refId: panel.metricId,
    length: points.length,
    fields: [
      {
        name: 'build',
        type: FieldType.string,
        config: {},
        values: points.map((p) => p.build),
      },
      {
        name: panel.title,
        type: FieldType.number,
        config: {
          links: [
            {
              title: 'Open build URL',
              url: '${__data.fields.buildUrl}',
              targetBlank: true,
            },
            {
              title: 'View details',
              url: '${__url.path}?${__url.params}&detailRunId=${__data.fields.runId}&detailMetricId=${__data.fields.metricId}',
              targetBlank: false,
            },
            ...snapshotLinks,
          ],
        },
        values: points.map((p) => p.value),
      },
      {
        name: 'buildUrl',
        type: FieldType.string,
        config: {},
        values: points.map((p) => p.buildUrl ?? ''),
      },
      {
        name: 'runId',
        type: FieldType.string,
        config: {},
        values: points.map((p) => p.runId ?? ''),
      },
      {
        name: 'metricId',
        type: FieldType.string,
        config: {},
        values: points.map(() => panel.metricId),
      },
      {
        name: 'snapshots',
        type: FieldType.string,
        config: {},
        values: snapshotIds.map((ids) => ids.join(', ')),
      },
      ...snapshotUrlFields,
    ],
  };

  const now = dateTime();
  const panelData: PanelData = {
    state: LoadingState.Done,
    series: [frame],
    timeRange: {
      from: now,
      to: now,
      raw: { from: now, to: now },
    },
  };

  const vizPanel = PanelBuilders.barchart()
    .setTitle(panel.title)
    .setDescription(clusterSubtitle(panel))
    .setData(new SceneDataNode({ data: panelData }))
    .setOverrides((b) => {
      b.matchFieldsWithName('buildUrl').overrideCustomFieldConfig('hideFrom', {
        tooltip: true,
        viz: true,
        legend: true,
      });
      b.matchFieldsWithName('runId').overrideCustomFieldConfig('hideFrom', {
        tooltip: true,
        viz: true,
        legend: true,
      });
      b.matchFieldsWithName('metricId').overrideCustomFieldConfig('hideFrom', {
        tooltip: true,
        viz: true,
        legend: true,
      });
      b.matchFieldsWithName('snapshots').overrideCustomFieldConfig('hideFrom', {
        tooltip: true,
        viz: true,
        legend: true,
      });
      for (let index = 0; index < maxSnapshotCount; index++) {
        b.matchFieldsWithName(`snapshotReportUrl${index + 1}`).overrideCustomFieldConfig('hideFrom', {
          tooltip: true,
          viz: true,
          legend: true,
        });
      }
    })
    .setOption('orientation', VizOrientation.Vertical)
    .setOption('xField', 'build')
    .setOption('xTickLabelRotation', 15)
    .setOption('barWidth', barWidth)
    .setOption('text', { valueSize: 12 })
    .setOption('showValue', VisibilityMode.Always)
    .setOption('legend', { showLegend: false })
    .build();

  return new SceneFlexItem({
    minHeight: 350,
    body: vizPanel,
  });
}
