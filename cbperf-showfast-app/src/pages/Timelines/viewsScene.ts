import React from 'react';
import {
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  SceneReactObject,
} from '@grafana/scenes';
import { ComponentViewUI } from './ComponentViewUI';
import { PanelGroup } from './timelinesApiTypes';
import { buildBarChartPanelItem } from './timelinesPanelBuilder';

function statusItem(message: string): SceneFlexItem {
  return new SceneFlexItem({
    minHeight: 64,
    body: new SceneReactObject({
      reactNode: React.createElement('div', { style: { padding: '12px 0', opacity: 0.6 } }, message),
    }),
  });
}

function groupHeaderItem(label: string): SceneFlexItem {
  return new SceneFlexItem({
    ySizing: 'content',
    body: new SceneReactObject({
      reactNode: React.createElement(
        'div',
        {
          style: {
            padding: '8px 0 4px',
            fontSize: 13,
            fontWeight: 600,
            opacity: 0.75,
            borderBottom: '1px solid rgba(128,128,128,0.2)',
            marginBottom: 4,
          },
        },
        label
      ),
    }),
  });
}

let _scene: EmbeddedScene | undefined;

export function viewsScene(): EmbeddedScene {
  if (_scene) {
    return _scene;
  }

  // Chrome lives in a stable SceneFlexItem so updating the children array
  // below does not deactivate/remount it — the same object reference is reused.
  const chromeItem = new SceneFlexItem({ ySizing: 'content', body: new SceneReactObject({ reactNode: null }) });

  const layout = new SceneFlexLayout({
    direction: 'column',
    children: [chromeItem, statusItem('Select a component and category to load panels.')],
  });

  function onGroupsChange(groups: PanelGroup[]) {
    const totalPanels = groups.reduce((sum, g) => sum + g.panels.length, 0);
    const children: SceneFlexItem[] = [chromeItem];

    if (totalPanels === 0) {
      children.push(statusItem('No panels match the current filters.'));
    } else {
      const showHeaders = groups.length > 1 || (groups.length === 1 && groups[0].label !== '');
      for (const group of groups) {
        if (showHeaders && group.label) {
          children.push(groupHeaderItem(group.label));
        }
        for (const panel of group.panels) {
          children.push(buildBarChartPanelItem(panel));
        }
      }
    }

    layout.setState({ children });
  }

  function onLoadingChange(loading: boolean) {
    if (loading) {
      layout.setState({ children: [chromeItem, statusItem('Loading panels…')] });
    }
  }

  // Now wire the chrome's actual content — the callbacks close over layout/chromeItem above.
  chromeItem.setState({
    body: new SceneReactObject({
      reactNode: React.createElement(ComponentViewUI, { onGroupsChange, onLoadingChange }),
    }),
  });

  _scene = new EmbeddedScene({ body: layout });
  return _scene;
}
