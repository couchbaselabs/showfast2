import React from 'react';
import { useTheme2 } from '@grafana/ui';
import { ComponentStatus } from './homeApiTypes';

interface Props {
  status: ComponentStatus;
}

function borderColor(status: ComponentStatus, theme: ReturnType<typeof useTheme2>): string {
  if (status.total === 0 || (status.passed === 0 && status.warning === 0 && status.regressed === 0)) {
    return theme.colors.border.medium;
  }
  if (status.regressed > 0) {
    return theme.colors.error.border;
  }
  if (status.warning > 0) {
    return theme.colors.warning.border;
  }
  return theme.colors.success.border;
}

export function ComponentCard({ status }: Props) {
  const theme = useTheme2();
  const top = borderColor(status, theme);

  return (
    <div
      style={{
        flex: '1 1 200px',
        minWidth: 180,
        padding: theme.spacing(2),
        borderRadius: theme.shape.radius.default,
        border: `1px solid ${theme.colors.border.weak}`,
        borderTop: `3px solid ${top}`,
        background: theme.colors.background.primary,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: theme.spacing(1) }}>
        {status.component}
      </div>
      <div style={{ fontSize: 12, color: theme.colors.text.secondary, marginBottom: theme.spacing(1) }}>
        {status.total} run{status.total !== 1 ? 's' : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {status.passed > 0 && (
          <div style={{ fontSize: 12, color: theme.colors.success.text }}>
            ✓ {status.passed} passed
          </div>
        )}
        {status.warning > 0 && (
          <div style={{ fontSize: 12, color: theme.colors.warning.text }}>
            ⚠ {status.warning} warning
          </div>
        )}
        {status.regressed > 0 && (
          <div style={{ fontSize: 12, color: theme.colors.error.text }}>
            ✗ {status.regressed} regressed
          </div>
        )}
        {status.neutral > 0 && (
          <div style={{ fontSize: 12, color: theme.colors.text.disabled }}>
            — {status.neutral} neutral
          </div>
        )}
        {status.total === 0 && (
          <div style={{ fontSize: 12, color: theme.colors.text.disabled }}>No runs</div>
        )}
      </div>
    </div>
  );
}
