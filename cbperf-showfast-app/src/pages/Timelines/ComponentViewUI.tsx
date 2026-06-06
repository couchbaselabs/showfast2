import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Input, Select, Spinner, Tab, TabsBar, useTheme2 } from '@grafana/ui';
import { MenuConfig } from './menuApiTypes';
import { fetchMenuConfig, fetchPanelsForView } from './menuService';
import { TimelinePanel } from './timelinesApiTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cacheKey(component: string, category: string): string {
  return `${component}:${category}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ComponentViewUIProps {
  /** Called whenever the set of client-side-filtered panels changes. */
  onPanelsChange: (panels: TimelinePanel[]) => void;
  /** Called when a panel fetch starts (true) or finishes (false). */
  onLoadingChange: (loading: boolean) => void;
}

// ---------------------------------------------------------------------------
// ComponentViewUI
// ---------------------------------------------------------------------------

export function ComponentViewUI({ onPanelsChange, onLoadingChange }: ComponentViewUIProps) {
  const theme = useTheme2();

  // Menu loading
  const [menu, setMenu] = useState<MenuConfig | null>(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  // Selections
  const [variantKey, setVariantKey] = useState('');
  const [componentKey, setComponentKey] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // Client-side filters
  const [subCategoryFilter, setSubCategoryFilter] = useState('');
  const [osFilter, setOsFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  // Panel data
  const [panelCache, setPanelCache] = useState<Record<string, TimelinePanel[]>>({});
  const [panelsLoading, setPanelsLoading] = useState(false);

  // True after menu load + URL params have been applied; gates URL writes
  const [menuInitialized, setMenuInitialized] = useState(false);
  // True on the very first URL write after init (use replace so we don't pollute history)
  const firstUrlWriteRef = useRef(true);

  // Keep a ref so the fetch callback can read the latest cache without stale closure
  const panelCacheRef = useRef(panelCache);
  panelCacheRef.current = panelCache;

  // -------------------------------------------------------------------------
  // Load menu on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    setMenuLoading(true);
    fetchMenuConfig()
      .then((cfg) => {
        setMenu(cfg);

        // Restore selections from URL params; fall back to first item when absent/invalid
        const search = locationService.getSearch();
        const urlVariant = search.get('variant');
        const urlComponent = search.get('component');
        const urlCategory = search.get('category');

        const v0 = (urlVariant ? cfg.variants.find((v) => v.id === urlVariant) : null) ?? cfg.variants[0];
        const c0 = (urlComponent ? v0?.components.find((c) => c.id === urlComponent) : null) ?? v0?.components[0];
        const cat0 = (urlCategory ? c0?.categories.find((c) => c.id === urlCategory) : null) ?? c0?.categories[0];

        setVariantKey(v0?.id ?? '');
        setComponentKey(c0?.id ?? '');
        setCategoryId(cat0?.id ?? '');
        setSubCategoryFilter(search.get('sub') ?? '');
        setOsFilter(search.get('os') ?? '');
        setSearchText(search.get('q') ?? '');
        setMenuInitialized(true);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load menu';
        setMenuError(msg);
      })
      .finally(() => setMenuLoading(false));
  }, []);

  // -------------------------------------------------------------------------
  // Sync selection state → URL query params
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!menuInitialized) {
      return;
    }
    const replace = firstUrlWriteRef.current;
    firstUrlWriteRef.current = false;
    locationService.partial(
      {
        variant: variantKey || null,
        component: componentKey || null,
        category: categoryId || null,
        sub: subCategoryFilter || null,
        os: osFilter || null,
        q: searchText || null,
      },
      replace
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuInitialized, variantKey, componentKey, categoryId, subCategoryFilter, osFilter, searchText]);

  // -------------------------------------------------------------------------
  // Derived menu data
  // -------------------------------------------------------------------------
  const variant = menu?.variants.find((v) => v.id === variantKey);
  const componentDef = variant?.components.find((c) => c.id === componentKey);
  const categoryDef = componentDef?.categories.find((c) => c.id === categoryId);

  const variantOptions: Array<SelectableValue<string>> = useMemo(
    () => (menu?.variants ?? []).map((v) => ({ value: v.id, label: v.label })),
    [menu]
  );

  // -------------------------------------------------------------------------
  // Fetch panels when component+category change
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!componentKey || !categoryId) {
      return;
    }
    const key = cacheKey(componentKey, categoryId);
    if (panelCacheRef.current[key] !== undefined) {
      return;
    }
    onLoadingChange(true);
    setPanelsLoading(true);
    fetchPanelsForView(componentKey, categoryId)
      .then((panels) => {
        setPanelCache((prev) => ({ ...prev, [key]: panels }));
      })
      .catch((err: unknown) => {
        console.error('panel fetch failed', componentKey, categoryId, err);
        setPanelCache((prev) => ({ ...prev, [key]: [] }));
      })
      .finally(() => {
        setPanelsLoading(false);
        onLoadingChange(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentKey, categoryId]);

  // -------------------------------------------------------------------------
  // Derive visible panels (client-side filtering)
  // -------------------------------------------------------------------------
  const allPanels = panelCache[cacheKey(componentKey, categoryId)] ?? null;

  const visiblePanels = useMemo(() => {
    if (!allPanels) {
      return null;
    }
    let panels = allPanels;
    if (subCategoryFilter) {
      panels = panels.filter((p) => p.subCategory === subCategoryFilter);
    }
    if (osFilter) {
      panels = panels.filter((p) => p.clusterInfo?.os === osFilter);
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      panels = panels.filter((p) => p.title.toLowerCase().includes(q));
    }
    return panels;
  }, [allPanels, subCategoryFilter, osFilter, searchText]);

  const availableOS = useMemo(
    () =>
      [...new Set((allPanels ?? []).map((p) => p.clusterInfo?.os).filter((o): o is string => Boolean(o)))].sort(),
    [allPanels]
  );

  // -------------------------------------------------------------------------
  // Notify parent when visible panels change
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (panelsLoading) {
      return; // parent already got onLoadingChange(true)
    }
    onPanelsChange(visiblePanels ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePanels, panelsLoading]);

  // -------------------------------------------------------------------------
  // Selection change handlers — reset client-side filters when data changes
  // -------------------------------------------------------------------------
  const selectVariant = useCallback(
    (vk: string) => {
      if (vk === variantKey || !menu) {
        return;
      }
      const v = menu.variants.find((x) => x.id === vk);
      const c0 = v?.components[0];
      setVariantKey(vk);
      setComponentKey(c0?.id ?? '');
      setCategoryId(c0?.categories[0]?.id ?? '');
      setSubCategoryFilter('');
      setOsFilter('');
      setSearchText('');
    },
    [variantKey, menu]
  );

  const selectComponent = useCallback(
    (ck: string) => {
      if (ck === componentKey || !variant) {
        return;
      }
      const comp = variant.components.find((c) => c.id === ck);
      setComponentKey(ck);
      setCategoryId(comp?.categories[0]?.id ?? '');
      setSubCategoryFilter('');
      setOsFilter('');
      setSearchText('');
    },
    [componentKey, variant]
  );

  const selectCategory = useCallback(
    (id: string) => {
      if (id === categoryId) {
        return;
      }
      setCategoryId(id);
      setSubCategoryFilter('');
      setOsFilter('');
      setSearchText('');
    },
    [categoryId]
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const sp = theme.spacing;
  const c = theme.colors;

  if (menuLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: sp(2), padding: sp(4) }}>
        <Spinner />
        <span style={{ color: c.text.secondary }}>Loading menu…</span>
      </div>
    );
  }

  if (menuError) {
    return (
      <div style={{ padding: sp(4), color: c.error.text }}>
        Menu unavailable: {menuError}
      </div>
    );
  }

  if (!menu || !variant || !componentDef) {
    return <div style={{ padding: sp(4), color: c.text.secondary }}>No menu data.</div>;
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-block',
    padding: `${sp(0.5)} ${sp(1.5)}`,
    borderRadius: theme.shape.radius.pill ?? '12px',
    border: `1px solid ${active ? c.primary.border : c.border.medium}`,
    background: active ? c.primary.transparent : 'transparent',
    color: active ? c.primary.text : c.text.secondary,
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: '20px',
    userSelect: 'none',
  });

  const sectionLabel: React.CSSProperties = {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: c.text.disabled,
    marginBottom: sp(0.5),
    whiteSpace: 'nowrap',
  };

  const osOptions: Array<SelectableValue<string>> = [
    { value: '', label: 'All OS' },
    ...availableOS.map((os) => ({ value: os, label: os })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: sp(2) }}>
      {/* Row 1: variant select · component tabs · OS · search · count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: sp(2),
          paddingBottom: sp(0.5),
          borderBottom: `1px solid ${c.border.weak}`,
        }}
      >
        {variantOptions.length > 1 && (
          <Select
            value={variantKey}
            options={variantOptions}
            onChange={(opt: SelectableValue<string>) => opt.value && selectVariant(opt.value)}
            width={14}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <TabsBar>
            {variant.components.map((comp) => (
              <Tab
                key={comp.id}
                label={comp.title}
                active={componentKey === comp.id}
                onChangeTab={() => selectComponent(comp.id)}
              />
            ))}
          </TabsBar>
        </div>

        {availableOS.length > 1 && (
          <Select
            options={osOptions}
            value={osFilter || ''}
            onChange={(opt: SelectableValue<string>) => setOsFilter(opt?.value ?? '')}
            width={14}
            isClearable={false}
          />
        )}

        <Input
          prefix={<span style={{ color: c.text.disabled }}>⌕</span>}
          placeholder="Search panels…"
          value={searchText}
          onChange={(e) => setSearchText(e.currentTarget.value)}
          width={22}
        />

        {panelsLoading ? (
          <Spinner />
        ) : (
          visiblePanels !== null && (
            <span style={{ fontSize: 12, color: c.text.disabled, whiteSpace: 'nowrap' }}>
              {visiblePanels.length} panel{visiblePanels.length !== 1 ? 's' : ''}
            </span>
          )
        )}
      </div>

      {/* Row 2: category tabs */}
      <div style={{ borderBottom: `1px solid ${c.border.weak}`, paddingBottom: sp(0.5) }}>
        <TabsBar>
          {componentDef.categories.map((cat) => (
            <Tab
              key={cat.id}
              label={cat.title}
              active={categoryId === cat.id}
              onChangeTab={() => selectCategory(cat.id)}
            />
          ))}
        </TabsBar>
      </div>

      {/* Row 3 (conditional): subcategory pills */}
      {categoryDef && categoryDef.subCategories.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: sp(0.75),
            alignItems: 'center',
            padding: `${sp(0.5)} 0`,
          }}
        >
          <span style={sectionLabel}>Sub:</span>
          <span style={pillStyle(subCategoryFilter === '')} onClick={() => setSubCategoryFilter('')}>
            All
          </span>
          {categoryDef.subCategories.map((sc) => (
            <span
              key={sc}
              style={pillStyle(subCategoryFilter === sc)}
              onClick={() => setSubCategoryFilter((prev) => (prev === sc ? '' : sc))}
            >
              {sc}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
