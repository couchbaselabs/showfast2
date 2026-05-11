import { SceneAppPage } from '@grafana/scenes';
import { ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';
import { timelinesScene } from './timelinesScene';

export const timelinesPage = new SceneAppPage({
  title: 'Timelines',
  url: prefixRoute(ROUTES.Timelines),
  routePath: ROUTES.Timelines,
  subTitle: 'Filter timelines with Grafana-native multi-select template variables.',
  getScene: () => timelinesScene(),
});
