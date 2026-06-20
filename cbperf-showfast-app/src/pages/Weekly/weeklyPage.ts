import { SceneAppPage } from '@grafana/scenes';
import { ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';
import { weeklyScene } from './weeklyScene';

export const weeklyPage = new SceneAppPage({
  title: 'Weekly',
  url: prefixRoute(ROUTES.Weekly),
  // The /* wildcard is required so React Router v6 passes child paths (e.g. weekly/8.0.1-1234)
  // into the nested <Routes> that SceneAppPageRenderer renders, enabling drilldown routing.
  routePath: `${ROUTES.Weekly}/*`,
  subTitle: 'Weekly pipeline results by build — metric-level pass, warning, and regression status.',
  getScene: () => weeklyScene(undefined),
  drilldowns: [
    {
      // Relative to the parent route's matched prefix (weekly/).
      // useParams() in SceneAppDrilldownViewRender provides { build: '<value>' } via React Router context.
      routePath: ':build',
      getPage(routeMatch, _parent) {
        const build = decodeURIComponent(routeMatch.params.build ?? '');
        return new SceneAppPage({
          title: `Weekly - ${build}`,
          url: prefixRoute(`${ROUTES.Weekly}/${encodeURIComponent(build)}`),
          getScene: () => weeklyScene(build),
        });
      },
    },
  ],
});
