/**
 * Timelines scene - displays performance timelines with filterable bar charts.
 * Keeps composition concerns in this file.
 */

import React from 'react';
import { Button } from '@grafana/ui';
import {
  EmbeddedScene,
  SceneReactObject,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneVariableSet,
  VariableValueSelectors,
} from '@grafana/scenes';
import { ensureRuntimeDataSourceRegistered } from './showfastFilterDataSource';
import { fetchTimelineBarChartPanels } from './timelinesPanelsService';
import { buildBarChartPanelItem } from './timelinesPanelBuilder';
import { TimelinePanel } from './timelinesApiTypes';
import { createTimelineVariableController } from './timelinesVariableController';

type TimelinesSceneState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; panels: TimelinePanel[] };

function buildMessageItem(message: string): SceneFlexItem {
  return new SceneFlexItem({
    minHeight: 64,
    body: new SceneReactObject({
      reactNode: React.createElement('div', { style: { padding: '8px 0' } }, message),
    }),
  });
}

/**
 * Build the Timelines scene with filter variables and placeholder content.
 * Phase 4 will add panel fetching and rendering here.
 */
export function timelinesScene() {
  ensureRuntimeDataSourceRegistered();

  const body = new SceneFlexLayout({
    direction: 'column',
    children: [buildMessageItem('Loading timeline panels...')],
  });

  const toPanelItem = buildBarChartPanelItem;

  const renderState = (state: TimelinesSceneState) => {
    if (state.kind === 'ready') {
      body.setState({
        children: state.panels.map((panel) => toPanelItem(panel)),
      });
      return;
    }

    const description =
      state.kind === 'loading'
        ? 'Loading timeline panels...'
        : state.kind === 'empty'
          ? 'No timeline panels match the current filter selection.'
          : `Failed to load timeline panels: ${state.message}`;

    body.setState({
      children: [buildMessageItem(description)],
    });
  };

  const refreshPanels = async () => {
    renderState({ kind: 'loading' });

    try {
      const panels = await fetchTimelineBarChartPanels();
      if (!panels || panels.length === 0) {
        renderState({ kind: 'empty' });
        return;
      }

      renderState({ kind: 'ready', panels });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      renderState({ kind: 'error', message });
    }
  };

  // Pass refreshPanels as onReady so panels load once after variables have resolved
  // their values from the URL — prevents querying with $__all on first render.
  const controller = createTimelineVariableController(() => {
    void refreshPanels();
  });

  const applyFiltersControl = new SceneReactObject({
    reactNode: React.createElement(Button, {
      variant: 'primary',
      size: 'sm',
      icon: 'sync',
      onClick: () => {
        void refreshPanels();
      },
      children: 'Apply',
    }),
  });

  return new EmbeddedScene({
    $variables: new SceneVariableSet({ variables: controller.variables }),
    body,
    controls: [new VariableValueSelectors({}), new SceneControlsSpacer(), applyFiltersControl],
  });
}
