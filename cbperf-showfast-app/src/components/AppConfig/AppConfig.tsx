import React, { useState } from 'react';
import { Button, FieldSet, Alert, useStyles2 } from '@grafana/ui';
import { PluginConfigPageProps, AppPluginMeta, GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { css } from '@emotion/css';
import { lastValueFrom } from 'rxjs';

export interface AppConfigProps extends PluginConfigPageProps<AppPluginMeta> {}

type ReloadState = 'idle' | 'loading' | 'success' | 'error';

const AppConfig = ({ plugin }: AppConfigProps) => {
  const s = useStyles2(getStyles);
  const [reloadState, setReloadState] = useState<ReloadState>('idle');

  const onReloadFilters = async () => {
    setReloadState('loading');
    try {
      await lastValueFrom(
        getBackendSrv().fetch({
          url: `/api/plugins/${plugin.meta.id}/resources/filters/reload`,
          method: 'POST',
        })
      );
      setReloadState('success');
    } catch {
      setReloadState('error');
    }
  };

  return (
    <div className={s.container}>
      <FieldSet label="Filter Cache">
        <p className={s.description}>
          Filter options (components, categories, clusters, etc.) are cached in memory at startup for
          fast loading. If new data has been added directly to Couchbase outside of the API, reload
          the cache to pick up the changes.
        </p>

        {reloadState === 'success' && (
          <Alert title="Cache reload triggered" severity="success" className={s.alert}>
            The filter cache has been cleared and is being rebuilt in the background. Filter dropdowns
            will reflect updated values within a few seconds.
          </Alert>
        )}
        {reloadState === 'error' && (
          <Alert title="Reload failed" severity="error" className={s.alert}>
            Could not reach the plugin backend. Check that the plugin is running and healthy.
          </Alert>
        )}

        <Button
          variant="secondary"
          icon={reloadState === 'loading' ? undefined : 'sync'}
          disabled={reloadState === 'loading'}
          onClick={onReloadFilters}
        >
          {reloadState === 'loading' ? 'Reloading…' : 'Reload Filter Cache'}
        </Button>
      </FieldSet>
    </div>
  );
};

export default AppConfig;

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    margin-top: ${theme.spacing(6)};
  `,
  description: css`
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(2)};
  `,
  alert: css`
    margin-bottom: ${theme.spacing(2)};
  `,
});
