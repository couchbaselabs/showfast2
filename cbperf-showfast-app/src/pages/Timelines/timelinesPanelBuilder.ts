import { DataFrame, FieldType, LoadingState, PanelData, dateTime } from '@grafana/data';
import { PanelBuilders, SceneDataNode, SceneFlexItem } from '@grafana/scenes';
import { VizOrientation, VisibilityMode } from '@grafana/schema';
import { TimelinePanel } from './timelinesApiTypes';

function formatSubtitle(panel: TimelinePanel): string {
  if (!panel.clusterInfo) {
    return panel.cluster;
  }
  const c = panel.clusterInfo;
  return `${c.name} | ${c.os} | ${c.cpu} | ${c.memory} | ${c.disk}`;
}

export function buildBarChartPanelItem(panel: TimelinePanel): SceneFlexItem {
  const points = panel.benchmarksValues ?? [];
  const snapshotLabels = points.map((p) => (p.snapshots && p.snapshots.length > 0 ? p.snapshots.join(', ') : ''));

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
          ],
        },
        values: points.map((p) => p.value),
      },
      {
        name: 'buildUrl',
        type: FieldType.string,
        config: {
          custom: {
            hideFrom: {
              tooltip: true,
              viz: true,
              legend: true,
            },
          },
        },
        values: points.map((p) => p.buildUrl ?? ''),
      },
      {
        name: 'snapshots',
        type: FieldType.string,
        config: {},
        values: snapshotLabels,
      },
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
    .setDescription(formatSubtitle(panel))
    .setData(new SceneDataNode({ data: panelData }))
    .setOption('orientation', VizOrientation.Vertical)
    .setOption('xField', 'build')
    .setOption('xTickLabelRotation', 45)
    .setOption('barWidth', 0.7)
    .setOption('showValue', VisibilityMode.Always)
    .build();

  return new SceneFlexItem({
    minHeight: 300,
    body: vizPanel,
  });
}
