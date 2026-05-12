import React from 'react';
import { EmbeddedScene, SceneFlexItem, SceneFlexLayout, SceneReactObject } from '@grafana/scenes';

function SearchContent() {
  return (
    <div
      style={{
        padding: 24,
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(18,24,38,0.96)',
        color: '#f5f7fb',
      }}
    >
      <h1 style={{ margin: '0 0 10px', fontSize: 36 }}>Search</h1>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'rgba(245,247,251,0.78)' }}>
        Search page placeholder. Add search controls and result views here when you are ready.
      </p>
    </div>
  );
}

export function searchScene() {
  return new EmbeddedScene({
    body: new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          body: new SceneReactObject({ reactNode: <SearchContent /> }),
        }),
      ],
    }),
  });
}
