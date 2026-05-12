import React from 'react';
import { EmbeddedScene, SceneFlexItem, SceneFlexLayout, SceneReactObject } from '@grafana/scenes';
import { Button, Icon, LinkButton, Stack, useTheme2 } from '@grafana/ui';
import { ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';

type LinkItem = {
  title: string;
  href: string;
  description: string;
};

const coreLinks: LinkItem[] = [
  {
    title: 'Timelines',
    href: prefixRoute(ROUTES.Timelines),
    description: 'Explore benchmark trends over time with filterable variables.',
  },
  {
    title: 'Search',
    href: prefixRoute(ROUTES.Search),
    description: 'Search across Showfast records and jump into specific results.',
  },
];

const futureLinks: LinkItem[] = [
  {
    title: 'More pages',
    href: '#',
    description: 'Add new Showfast pages here as the app grows.',
  },
];

function LandingContent() {
  const theme = useTheme2();

  return (
    <div
      style={{
        padding: theme.spacing(4),
        color: theme.colors.text.primary,
        minHeight: 'calc(100vh - 160px)',
      }}
    >
      <Stack direction="column" gap={4}>
        <div
          style={{
            borderBottom: `1px solid ${theme.colors.border.weak}`,
            paddingBottom: theme.spacing(4),
            marginBottom: theme.spacing(1),
          }}
        >
          <Stack direction="row" wrap={true} gap={2}>
            <div style={{ flex: '2 1 560px', minWidth: 340 }}>
              <h1 style={{ margin: '12px 0 10px', fontSize: 30, lineHeight: 1.08 }}>
                Performance exploration for Couchbase benchmark data.
              </h1>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: theme.colors.text.secondary, maxWidth: 900 }}>
                Use this app to navigate between timelines, search, and future views that help you inspect
                benchmark results, filter data, and compare system behavior across builds, clusters, and metrics.
              </p>
            </div>

            <div
              style={{
                flex: '1 1 240px',
                minWidth: 220,
                alignSelf: 'stretch',
                borderRadius: theme.shape.radius.default,
                border: `1px dashed ${theme.colors.border.medium}`,
                background: theme.colors.background.canvas,
                padding: theme.spacing(3),
              }}
            >
              <Stack direction="column" gap={1}>
                <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: theme.colors.text.secondary }}>
                  App status
                </div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>Version 1</div>
                <div style={{ color: theme.colors.text.secondary, lineHeight: 1.5 }}>
                  Space reserved for health signals, release notes, and quick metadata.
                </div>
              </Stack>
            </div>
          </Stack>
        </div>

        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: theme.spacing(2) }}>Start here</div>
          <Stack direction="row" wrap={true} gap={2}>
            {coreLinks.map((item) => (
              <div
                key={item.title}
                style={{
                  flex: '1 1 280px',
                  minWidth: 280,
                  padding: theme.spacing(3),
                  borderRadius: theme.shape.radius.default,
                  border: `1px solid ${theme.colors.border.weak}`,
                  background: theme.colors.background.primary,
                }}
              >
                <Stack direction="column" gap={1}>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{item.title}</div>
                  <div style={{ color: theme.colors.text.secondary, lineHeight: 1.5 }}>{item.description}</div>
                  <div>
                    <LinkButton href={item.href} icon="arrow-right" variant="primary">
                      Open {item.title}
                    </LinkButton>
                  </div>
                </Stack>
              </div>
            ))}
          </Stack>
        </div>

        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: theme.spacing(2) }}>More to add</div>
          <Stack direction="row" wrap={true} gap={2}>
            {futureLinks.map((item) => (
              <div
                key={item.title}
                style={{
                  flex: '1 1 280px',
                  minWidth: 280,
                  padding: theme.spacing(3),
                  borderRadius: theme.shape.radius.default,
                  border: `1px dashed ${theme.colors.border.medium}`,
                  background: theme.colors.background.canvas,
                }}
              >
                <Stack direction="column" gap={1}>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{item.title}</div>
                  <div style={{ color: theme.colors.text.secondary, lineHeight: 1.5 }}>{item.description}</div>
                  <Button variant="secondary" size="sm" disabled>
                    Coming soon
                  </Button>
                </Stack>
              </div>
            ))}
          </Stack>
        </div>
      </Stack>
    </div>
  );
}

export function homeScene() {
  return new EmbeddedScene({
    body: new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          body: new SceneReactObject({ reactNode: <LandingContent /> }),
        }),
      ],
    }),
  });
}
