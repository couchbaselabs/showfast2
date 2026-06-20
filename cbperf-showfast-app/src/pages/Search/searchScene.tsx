import React from 'react';
import { EmbeddedScene, SceneFlexItem, SceneFlexLayout, SceneReactObject } from '@grafana/scenes';

function SearchContent() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: '0 0 10px', fontSize: 36 }}>Search</h1>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6 }}>
        Search page placeholder. Add search controls and result views here when you are ready.
      </p>
    </div>
  );
}

export function searchScene() {
  return new EmbeddedScene({
    controls: [new SceneControlsSpacer(), new SceneReactObject({ reactNode: <AppNavHeader /> })],
    body: new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          body: new SceneReactObject({ reactNode: <SearchContent /> }),
        }),
      ],
    }),
  });
}
