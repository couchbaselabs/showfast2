import { SceneAppPage } from '@grafana/scenes';
import { ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';
import { searchScene } from './searchScene';

export const searchPage = new SceneAppPage({
  title: 'Search',
  url: prefixRoute(ROUTES.Search),
  routePath: ROUTES.Search,
  subTitle: 'Search Showfast data.',
  getScene: () => searchScene(),
});
