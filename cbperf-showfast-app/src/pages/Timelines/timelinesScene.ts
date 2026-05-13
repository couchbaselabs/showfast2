/**
 * Timelines scene - displays performance timelines with filterable bar charts.
 * Keeps composition concerns in this file.
 */

import { EmbeddedScene, PanelBuilders, SceneControlsSpacer, SceneFlexItem, SceneFlexLayout, SceneVariableSet, VariableValueSelectors } from '@grafana/scenes';
import { ensureRuntimeDataSourceRegistered } from './showfastFilterDataSource';
import { createTimelineVariableController } from './timelinesVariableController';

/**
 * Build the Timelines scene with filter variables and placeholder content.
 * Phase 4 will add panel fetching and rendering here.
 */
export function timelinesScene() {
  ensureRuntimeDataSourceRegistered();
  const controller = createTimelineVariableController(() => {
    // TODO: Phase 4 - trigger panel refresh here
  });

  return new EmbeddedScene({
    $variables: new SceneVariableSet({ variables: controller.variables }),
    body: new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          minHeight: 120,
          body: PanelBuilders.text()
            .setTitle('Timelines')
            .setDescription('Panels will load based on selected filters. Phase 4 coming soon.')
            .build(),
        }),
      ],
    }),
    controls: [new VariableValueSelectors({}), new SceneControlsSpacer()],
  });
}
