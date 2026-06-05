import { EmbeddedScene, SceneAppPage } from '@grafana/scenes';
import { ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';
import { timelinesScene } from './timelinesScene';

// Cache the scene instance so getScene() doesn't recreate it on every Grafana
// router call during variable initialization (which would fire multiple concurrent
// panel fetches before variables have resolved from the URL).
let _scene: EmbeddedScene | undefined;

export const timelinesPage = new SceneAppPage({
  title: 'Timelines',
  url: prefixRoute(ROUTES.Timelines),
  routePath: ROUTES.Timelines,
  subTitle: 'Filter timelines with Grafana-native multi-select template variables.',
  getScene: () => {
    if (!_scene) {
      _scene = timelinesScene();
    }
    return _scene;
  },
});
