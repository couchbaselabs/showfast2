import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';

export interface ExplorePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing(2),
      padding: theme.spacing(2, 0),
    }),
    info: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      minWidth: 160,
      textAlign: 'center',
    }),
  };
}

export function ExplorePagination({ page, totalPages, total, pageSize, onPrev, onNext }: ExplorePaginationProps) {
  const styles = useStyles2(getStyles);
  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, total);

  return (
    <div className={styles.row}>
      <Button
        variant="secondary"
        size="sm"
        icon="angle-left"
        onClick={onPrev}
        disabled={page === 0}
      >
        Previous
      </Button>
      <span className={styles.info}>
        {start}–{end} of {total} metrics &nbsp;·&nbsp; page {page + 1} of {totalPages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        icon="angle-right"
        onClick={onNext}
        disabled={page >= totalPages - 1}
      >
        Next
      </Button>
    </div>
  );
}
