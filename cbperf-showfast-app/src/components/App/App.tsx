import React from 'react';
import { SceneApp, useSceneApp } from '@grafana/scenes';
import { AppRootProps } from '@grafana/data';
import { PluginPropsContext } from '../../utils/utils.plugin';
import { explorePage } from '../../pages/Explore/explorePage';
import { homePage } from '../../pages/Home/homePage';
import { searchPage } from '../../pages/Search/searchPage';
import { timelinesPage } from '../../pages/Timelines/timelinesPage';
import { weeklyPage } from '../../pages/Weekly/weeklyPage';
import { BenchmarkDetailController } from './BenchmarkDetailController';

function getSceneApp() {
  return new SceneApp({
    pages: [homePage, timelinesPage, explorePage, searchPage, weeklyPage],
    urlSyncOptions: {
      // Keep deep-link query params (including custom tag filters) intact on first load.
      updateUrlOnInit: false,
      createBrowserHistorySteps: true,
    },
  });
}

function AppWithScenes() {
  const scene = useSceneApp(getSceneApp);

  return <scene.Component model={scene} />;
}

function App(props: AppRootProps) {
  return (
    <PluginPropsContext.Provider value={props}>
      <BenchmarkDetailController>
        <AppWithScenes />
      </BenchmarkDetailController>
    </PluginPropsContext.Provider>
  );
}

export default App;
