import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme2 } from '@grafana/ui';
import { PLUGIN_BASE_URL, ROUTES } from '../constants';
import { prefixRoute } from '../utils/utils.routing';

const NAV_ITEMS = [
  { label: 'Home', route: ROUTES.Home },
  { label: 'Timelines', route: ROUTES.Timelines },
  { label: 'Weekly', route: ROUTES.Weekly },
  { label: 'Metrics Explore', route: ROUTES.MetricsExplore },
];

export function AppNavHeader() {
  const theme = useTheme2();
  const { pathname } = useLocation();

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `${theme.spacing(0.75)} ${theme.spacing(2)}`,
        borderBottom: `1px solid ${theme.colors.border.weak}`,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: -0.3,
          color: theme.colors.text.primary,
          userSelect: 'none',
        }}
      >
        Showfast
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing(1.5) }}>
      {NAV_ITEMS.map(({ label, route }, i) => {
        const isActive =
          route === ROUTES.Home
            ? pathname === PLUGIN_BASE_URL || pathname === `${PLUGIN_BASE_URL}/`
            : pathname.startsWith(`${PLUGIN_BASE_URL}/${route}`);

        return (
          <React.Fragment key={route}>
            {i > 0 && (
              <span style={{ color: theme.colors.border.medium, fontSize: 11, userSelect: 'none' }}>·</span>
            )}
            <a
              href={prefixRoute(route)}
              style={{
                fontSize: 12,
                color: isActive ? theme.colors.text.primary : theme.colors.text.secondary,
                fontWeight: isActive ? 600 : 400,
                textDecoration: 'none',
                opacity: isActive ? 1 : 0.75,
              }}
            >
              {label}
            </a>
          </React.Fragment>
        );
      })}
      </div>
    </div>
  );
}
