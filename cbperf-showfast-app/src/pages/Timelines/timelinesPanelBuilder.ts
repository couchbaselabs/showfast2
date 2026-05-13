import { DataFrame, FieldType, LoadingState, PanelData, dateTime } from '@grafana/data';
import { PanelBuilders, SceneDataNode, SceneFlexItem } from '@grafana/scenes';
import { VizOrientation } from '@grafana/schema';
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
        config: {},
        values: points.map((p) => p.value),
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
    .setOption('barWidth', 0.8)
    .build();

  return new SceneFlexItem({
    minHeight: Math.max(200, points.length * 30 + 80),
    body: vizPanel,
  });
}
