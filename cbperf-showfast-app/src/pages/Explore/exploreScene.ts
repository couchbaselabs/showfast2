import React from 'react';
import {
  EmbeddedScene,
  SceneReactObject,
  SceneFlexItem,
  SceneFlexLayout,
} from '@grafana/scenes';
import { ExploreFacetPanel } from './ExploreFacetPanel';
import { ExplorePagination } from './ExplorePagination';
import { FilterValues, ExploreOptions, DEFAULT_EXPLORE_OPTIONS } from './exploreFiltersService';
import {
  fetchTimelineBarChartPanelsPage,
  EXPLORE_PAGE_SIZE,
  PaginatedPanelsResponse,
} from './explorePanelsService';
import { buildBarChartPanelItem } from '../Timelines/timelinesPanelBuilder';
import { TimelinePanel } from '../Timelines/timelinesApiTypes';

type ExploreState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; response: PaginatedPanelsResponse };

function buildMessageItem(message: string): SceneFlexItem {
  return new SceneFlexItem({
    minHeight: 64,
    body: new SceneReactObject({
      reactNode: React.createElement(
        'div',
        { style: { padding: '8px 0', color: 'var(--text-color-secondary)' } },
        message
      ),
    }),
  });
}

function buildPaginationItem(
  response: PaginatedPanelsResponse,
  onPage: (page: number) => void
): SceneFlexItem {
  const page = Math.floor(response.offset / response.limit);
  const totalPages = Math.ceil(response.total / response.limit);
  return new SceneFlexItem({
    minHeight: 56,
    body: new SceneReactObject({
      reactNode: React.createElement(ExplorePagination, {
        page,
        totalPages,
        total: response.total,
        pageSize: response.limit,
        onPrev: () => onPage(page - 1),
        onNext: () => onPage(page + 1),
      }),
    }),
  });
}

export function exploreScene(): EmbeddedScene {
  // Mutable scene state — captured by all closures in this factory call.
  let lastSelected: FilterValues = {};
  let lastOptions: ExploreOptions = DEFAULT_EXPLORE_OPTIONS;

  const resultsLayout = new SceneFlexLayout({
    direction: 'column',
    children: [buildMessageItem('Select filters and press Apply to load panels.')],
  });

  const renderState = (state: ExploreState) => {
    if (state.kind === 'ready') {
      const { response } = state;
      const panelItems = response.panels.map((p: TimelinePanel) =>
        new SceneFlexItem({
          ySizing: 'content',
          minHeight: 400,
          height: 400,
          body: buildBarChartPanelItem(p).state.body,
        })
      );
      const showPagination = response.total > response.limit;
      resultsLayout.setState({
        children: showPagination
          ? [...panelItems, buildPaginationItem(response, goToPage)]
          : panelItems,
      });
      return;
    }
    const message =
      state.kind === 'loading'
        ? 'Loading timeline panels...'
        : state.kind === 'empty'
          ? 'No timeline panels match the current filter selection.'
          : state.kind === 'error'
            ? `Failed to load timeline panels: ${state.message}`
            : 'Select filters and press Apply to load panels.';
    resultsLayout.setState({ children: [buildMessageItem(message)] });
  };

  const goToPage = (page: number) => {
    renderState({ kind: 'loading' });
    fetchTimelineBarChartPanelsPage(lastSelected, page, EXPLORE_PAGE_SIZE, lastOptions)
      .then((response) => {
        renderState(response.panels.length === 0 ? { kind: 'empty' } : { kind: 'ready', response });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'unknown error';
        renderState({ kind: 'error', message });
      });
  };

  const onApply = (selected: FilterValues, options: ExploreOptions) => {
    lastSelected = selected;
    lastOptions = options;
    goToPage(0);
  };

  const facetPanel = new SceneReactObject({
    reactNode: React.createElement(ExploreFacetPanel, { onApply }),
  });

  const body = new SceneFlexLayout({
    direction: 'row',
    children: [
      new SceneFlexItem({
        ySizing: 'content',
        width: 220,
        minWidth: 220,
        body: facetPanel,
      }),
      new SceneFlexItem({
        body: resultsLayout,
      }),
    ],
  });

  return new EmbeddedScene({
    body,
  });
}
