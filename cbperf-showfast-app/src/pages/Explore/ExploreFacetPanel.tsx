import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, Input, Spinner, Switch, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { FILTER_DEFINITIONS } from '../Timelines/filterConfig';
import {
  BulkFilters,
  ExploreOptions,
  DEFAULT_EXPLORE_OPTIONS,
  FilterValues,
  fetchBulkFilters,
  getUnfilteredFilters,
} from './exploreFiltersService';

export interface ExploreFacetPanelProps {
  onApply: (selected: FilterValues, options: ExploreOptions) => void;
}

// Dimensions that don't participate in cross-filter narrowing: selecting them
// doesn't refetch other filter options, and they're excluded from the bulk
// filter request so the backend doesn't narrow them based on other selections.
const INDEPENDENT_FILTERS = new Set(['pipelineGroup']);

function toFilterRequest(selected: FilterValues): FilterValues {
  return Object.fromEntries(Object.entries(selected).filter(([k]) => !INDEPENDENT_FILTERS.has(k)));
}

const EMPTY_BULK: BulkFilters = {
  component: [],
  category: [],
  subcategory: [],
  cluster: [],
  os: [],
  pipelineGroup: [],
  serverMajorMinor: [],
};

const NAME_TO_BULK_KEY: Record<string, keyof BulkFilters> = {
  component: 'component',
  category: 'category',
  subcategory: 'subcategory',
  cluster: 'cluster',
  os: 'os',
  pipelineGroup: 'pipelineGroup',
  serverMajorMinor: 'serverMajorMinor',
};

function getStyles(theme: GrafanaTheme2) {
  return {
    panel: css({
      display: 'flex',
      flexDirection: 'column',
      width: 220,
      minWidth: 220,
      flexShrink: 0,
      height: '100%',
      backgroundColor: theme.colors.background.secondary,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      overflowY: 'auto',
    }),
    header: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing(1.5, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    headerTitle: css({
      fontWeight: theme.typography.fontWeightBold,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
    }),
    headerCount: css({
      color: theme.colors.primary.text,
    }),
    clearAllBtn: css({
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.primary.text,
      padding: 0,
      '&:hover': { textDecoration: 'underline' },
    }),
    applyWrapper: css({
      padding: theme.spacing(1.5, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    facets: css({
      flex: 1,
      overflowY: 'auto',
    }),
    facetSection: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    facetHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing(1.25, 2, 0.5),
    }),
    facetLabel: css({
      fontSize: 11,
      fontWeight: theme.typography.fontWeightBold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: theme.colors.text.secondary,
    }),
    clearDimBtn: css({
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: 11,
      color: theme.colors.primary.text,
      padding: 0,
      '&:hover': { textDecoration: 'underline' },
    }),
    facetValues: css({
      padding: theme.spacing(0, 2, 1.25),
      transition: 'opacity 0.15s ease',
    }),
    facetValuesLoading: css({
      opacity: 0.45,
    }),
    facetValueRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.4, 0.5),
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      userSelect: 'none',
      '&:hover': {
        backgroundColor: theme.colors.action.hover,
      },
    }),
    facetValueRowSelected: css({
      backgroundColor: theme.colors.action.selected,
    }),
    checkboxBox: css({
      width: 14,
      height: 14,
      flexShrink: 0,
      border: `2px solid ${theme.colors.border.medium}`,
      borderRadius: 2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background.primary,
    }),
    checkboxBoxChecked: css({
      backgroundColor: theme.colors.primary.main,
      borderColor: theme.colors.primary.main,
    }),
    checkMark: css({
      color: theme.colors.primary.contrastText,
      fontSize: 10,
      lineHeight: 1,
      fontWeight: 700,
    }),
    facetValueText: css({
      fontSize: 13,
      color: theme.colors.text.secondary,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    facetValueTextSelected: css({
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    noOptions: css({
      fontSize: 12,
      color: theme.colors.text.disabled,
      padding: theme.spacing(0, 0.5, 0.5),
    }),
    spinnerRow: css({
      display: 'flex',
      justifyContent: 'center',
      padding: theme.spacing(1),
    }),
    optionsSection: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(1, 2),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
    }),
    optionRow: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      cursor: 'pointer',
    }),
    optionLabel: css({
      fontSize: 12,
      color: theme.colors.text.secondary,
    }),
    searchWrapper: css({
      padding: theme.spacing(1, 2, 1.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
  };
}

export function ExploreFacetPanel({ onApply }: ExploreFacetPanelProps) {
  const styles = useStyles2(getStyles);
  const [options, setOptions] = useState<BulkFilters>(EMPTY_BULK);
  const [selected, setSelected] = useState<FilterValues>({});
  const [exploreOptions, setExploreOptions] = useState<ExploreOptions>(DEFAULT_EXPLORE_OPTIONS);
  const [loading, setLoading] = useState(true);
  const inflightRef = useRef<Promise<void> | null>(null);
  // Refs so callbacks never close over stale state
  const selectedRef = useRef<FilterValues>({});
  const exploreOptionsRef = useRef<ExploreOptions>(DEFAULT_EXPLORE_OPTIONS);

  useEffect(() => {
    // Use the module-level prefetch so the initial load is instant if
    // the fetch already completed while the user was on another page.
    getUnfilteredFilters()
      .then((bulk) => {
        setOptions(bulk);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const doRefetch = useCallback((nextSelected: FilterValues) => {
    setLoading(true);
    // Independent filters and show-hidden flags are excluded from filter option fetching.
    const req = fetchBulkFilters(toFilterRequest(nextSelected))
      .then((bulk) => {
        if (inflightRef.current === req) {
          // Preserve independent dimension options from the initial unfiltered load —
          // they must always show the full list regardless of other active filters.
          setOptions((prev) => ({
            ...bulk,
            pipelineGroup: prev.pipelineGroup,
          }));
          setLoading(false);
        }
      })
      .catch(() => {
        if (inflightRef.current === req) {
          setLoading(false);
        }
      });
    inflightRef.current = req;
  }, []);

  const toggle = useCallback(
    (dim: string, value: string) => {
      setSelected((prev) => {
        const prevValues = prev[dim] ?? [];
        const next = prevValues.includes(value)
          ? prevValues.filter((v) => v !== value)
          : [...prevValues, value];
        const nextSelected: FilterValues = { ...prev };
        if (next.length > 0) {
          nextSelected[dim] = next;
        } else {
          delete nextSelected[dim];
        }
        selectedRef.current = nextSelected;
        if (!INDEPENDENT_FILTERS.has(dim)) {
          doRefetch(nextSelected);
        }
        return nextSelected;
      });
    },
    [doRefetch]
  );

  const clearDim = useCallback(
    (dim: string) => {
      setSelected((prev) => {
        const next = { ...prev };
        delete next[dim];
        selectedRef.current = next;
        if (!INDEPENDENT_FILTERS.has(dim)) {
          doRefetch(next);
        }
        return next;
      });
    },
    [doRefetch]
  );

  const clearAll = useCallback(() => {
    const next: FilterValues = {};
    selectedRef.current = next;
    setSelected(next);
    const nextOpts = { ...exploreOptionsRef.current, titleSearch: '' };
    exploreOptionsRef.current = nextOpts;
    setExploreOptions(nextOpts);
    doRefetch(next);
  }, [doRefetch]);

  const toggleExploreOption = useCallback(
    (key: keyof ExploreOptions) => {
      setExploreOptions((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        exploreOptionsRef.current = next;
        // Show-hidden flags don't affect filter options — no refetch needed.
        return next;
      });
    },
    []
  );

  const totalSelected = Object.values(selected).reduce((sum, vals) => sum + (vals?.length ?? 0), 0);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          Filters{' '}
          {totalSelected > 0 && <span className={styles.headerCount}>({totalSelected})</span>}
        </span>
        {totalSelected > 0 && (
          <button className={styles.clearAllBtn} onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>

      <div className={styles.applyWrapper}>
        <Button variant="primary" size="sm" icon="search" fullWidth onClick={() => onApply(selected, exploreOptionsRef.current)}>
          Apply
        </Button>
      </div>

      <div className={styles.searchWrapper}>
        <Input
          placeholder="Search metrics…"
          value={exploreOptions.titleSearch}
          onChange={(e) => {
            const next = { ...exploreOptionsRef.current, titleSearch: e.currentTarget.value };
            exploreOptionsRef.current = next;
            setExploreOptions(next);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onApply(selectedRef.current, exploreOptionsRef.current);
            }
          }}
        />
      </div>

      <div className={styles.optionsSection}>
        <div className={styles.optionRow}>
          <span className={styles.optionLabel}>Show hidden metrics</span>
          <Switch
            value={exploreOptions.showHiddenMetrics}
            onChange={() => toggleExploreOption('showHiddenMetrics')}
          />
        </div>
        <div className={styles.optionRow}>
          <span className={styles.optionLabel}>Show hidden benchmarks</span>
          <Switch
            value={exploreOptions.showHiddenBenchmarks}
            onChange={() => toggleExploreOption('showHiddenBenchmarks')}
          />
        </div>
      </div>

      <div className={styles.facets}>
        {FILTER_DEFINITIONS.map((def) => {
          const bulkKey = NAME_TO_BULK_KEY[def.name];
          const checkedSet = new Set(selected[def.name] ?? []);

          // Merge available options with any currently-selected values so selected
          // items don't disappear while other filters narrow the list.
          const available = options[bulkKey] ?? [];
          const merged = [
            ...(selected[def.name] ?? []).filter((v) => !available.includes(v)),
            ...available,
          ];

          return (
            <div key={def.name} className={styles.facetSection}>
              <div className={styles.facetHeader}>
                <span className={styles.facetLabel}>{def.label}</span>
                {checkedSet.size > 0 && (
                  <button className={styles.clearDimBtn} onClick={() => clearDim(def.name)}>
                    clear
                  </button>
                )}
              </div>

              <div className={`${styles.facetValues}${loading ? ` ${styles.facetValuesLoading}` : ''}`}>
                {merged.length === 0 ? (
                  <span className={styles.noOptions}>{loading ? '…' : 'No options'}</span>
                ) : (
                  merged.map((value) => {
                    const isChecked = checkedSet.has(value);
                    return (
                      <div
                        key={value}
                        className={`${styles.facetValueRow}${isChecked ? ` ${styles.facetValueRowSelected}` : ''}`}
                        onClick={() => toggle(def.name, value)}
                      >
                        <div
                          className={`${styles.checkboxBox}${isChecked ? ` ${styles.checkboxBoxChecked}` : ''}`}
                        >
                          {isChecked && <span className={styles.checkMark}>✓</span>}
                        </div>
                        <span
                          className={`${styles.facetValueText}${isChecked ? ` ${styles.facetValueTextSelected}` : ''}`}
                          title={value}
                        >
                          {value}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loading && (
        <div className={styles.spinnerRow}>
          <Spinner size="sm" />
        </div>
      )}
    </div>
  );
}
