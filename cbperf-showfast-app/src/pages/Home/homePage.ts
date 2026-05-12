import { SceneAppPage } from '@grafana/scenes';
import { ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';
import { homeScene } from './homeScene';

export const homePage = new SceneAppPage({
  title: 'Showfast',
  url: prefixRoute(ROUTES.Home),
  routePath: ROUTES.Home,
  getScene: () => homeScene(),
});
