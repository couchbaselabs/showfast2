/**
 * Timelines scene - displays performance timelines with filterable bar charts.
 * Keeps composition concerns in this file.
 */

import {
  EmbeddedScene,
  PanelBuilders,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneVariableSet,
  VariableValueSelectors,
} from '@grafana/scenes';
import { ensureRuntimeDataSourceRegistered } from './showfastFilterDataSource';
import { fetchTimelinePanels } from './timelinesPanelsService';
import { buildBarChartPanelItem } from './timelinesPanelBuilder';
import { createTimelineVariableController } from './timelinesVariableController';

/**
 * Build the Timelines scene with filter variables and placeholder content.
 * Phase 4 will add panel fetching and rendering here.
 */
export function timelinesScene() {
  ensureRuntimeDataSourceRegistered();

  const body = new SceneFlexLayout({
    direction: 'column',
    children: [
      new SceneFlexItem({
        minHeight: 120,
        body: PanelBuilders.text()
          .setTitle('Timelines')
          .setDescription('Loading timeline panels...')
          .build(),
      }),
    ],
  });

  const toPanelItem = buildBarChartPanelItem;

  const renderEmpty = () => {
    body.setState({
      children: [
        new SceneFlexItem({
          minHeight: 120,
          body: PanelBuilders.text()
            .setTitle('Timelines')
            .setDescription('No timeline panels match the current filter selection.')
            .build(),
        }),
      ],
    });
  };

  const renderError = (message: string) => {
    body.setState({
      children: [
        new SceneFlexItem({
          minHeight: 120,
          body: PanelBuilders.text()
            .setTitle('Timelines')
            .setDescription(`Failed to load timeline panels: ${message}`)
            .build(),
        }),
      ],
    });
  };

  const refreshPanels = async () => {
    try {
      const panels = await fetchTimelinePanels();
      if (!panels || panels.length === 0) {
        renderEmpty();
        return;
      }

      body.setState({
        children: panels.map((panel) => toPanelItem(panel)),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      renderError(message);
    }
  };

  const controller = createTimelineVariableController(() => {
    return refreshPanels();
  });

  return new EmbeddedScene({
    $variables: new SceneVariableSet({ variables: controller.variables }),
    body,
    controls: [new VariableValueSelectors({}), new SceneControlsSpacer()],
  });
}
