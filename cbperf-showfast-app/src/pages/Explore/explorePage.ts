import { EmbeddedScene, SceneAppPage } from '@grafana/scenes';
import { ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';
import { prefetchUnfilteredFilters } from './exploreFiltersService';
import { exploreScene } from './exploreScene';

// Start the unfiltered filter fetch immediately when this module loads so
// the data is ready (or in-flight) by the time the user navigates to Explore.
prefetchUnfilteredFilters();

let _scene: EmbeddedScene | undefined;

export const explorePage = new SceneAppPage({
  title: 'Metrics Explore',
  url: prefixRoute(ROUTES.MetricsExplore),
  routePath: ROUTES.MetricsExplore,
  subTitle: 'Filter metrics by selecting one or more values in each category.',
  getScene: () => {
    if (!_scene) {
      _scene = exploreScene();
    }
    return _scene;
  },
});
