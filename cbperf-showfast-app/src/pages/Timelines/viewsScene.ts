import React from 'react';
import {
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  SceneReactObject,
} from '@grafana/scenes';
import { ComponentViewUI } from './ComponentViewUI';
import { TimelinePanel } from './timelinesApiTypes';
import { buildBarChartPanelItem } from './timelinesPanelBuilder';

function statusItem(message: string): SceneFlexItem {
  return new SceneFlexItem({
    minHeight: 64,
    body: new SceneReactObject({
      reactNode: React.createElement('div', { style: { padding: '12px 0', opacity: 0.6 } }, message),
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

  function onPanelsChange(panels: TimelinePanel[]) {
    layout.setState({
      children: [
        chromeItem,
        ...(panels.length
          ? panels.map(buildBarChartPanelItem)
          : [statusItem('No panels match the current filters.')]),
      ],
    });
  }

  function onLoadingChange(loading: boolean) {
    if (loading) {
      layout.setState({ children: [chromeItem, statusItem('Loading panels…')] });
    }
  }

  // Now wire the chrome's actual content — the callbacks close over layout/chromeItem above.
  chromeItem.setState({
    body: new SceneReactObject({
      reactNode: React.createElement(ComponentViewUI, { onPanelsChange, onLoadingChange }),
    }),
  });

  _scene = new EmbeddedScene({ body: layout });
  return _scene;
}
