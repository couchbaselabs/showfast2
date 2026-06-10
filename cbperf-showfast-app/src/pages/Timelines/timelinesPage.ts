import { SceneAppPage } from '@grafana/scenes';
import { ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';
import { viewsScene } from './viewsScene';

export const timelinesPage = new SceneAppPage({
  title: 'Performance Dashboard',
  url: prefixRoute(ROUTES.Timelines),
  routePath: ROUTES.Timelines,
  getScene: viewsScene,
});
