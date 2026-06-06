import { EmbeddedScene, SceneAppPage } from '@grafana/scenes';
import { ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';
import { timelinesScene } from './timelinesScene';

let _scene: EmbeddedScene | undefined;

export const explorePage = new SceneAppPage({
  title: 'Explore',
  url: prefixRoute(ROUTES.TimelinesExplore),
  routePath: ROUTES.TimelinesExplore,
  subTitle: 'Filter timelines with Grafana-native multi-select template variables.',
  getScene: () => {
    if (!_scene) {
      _scene = timelinesScene();
    }
    return _scene;
  },
});
