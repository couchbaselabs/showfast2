import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Input, Select, Spinner, Tab, TabsBar, useTheme2 } from '@grafana/ui';
import { ComponentConfig, VariantsConfig, dbComponentIDsForVariant } from './menuApiTypes';
import { fetchComponentConfig, fetchPanelsForView, fetchVariantsConfig } from './menuService';
import { TimelinePanel } from './timelinesApiTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cacheKey(variantId: string, componentId: string, category: string): string {
  return `${variantId}:${componentId}:${category}`;
}

function firstVisibleCategory(cfg: ComponentConfig, variantId: string): string {
  return cfg.categories.find((c) => c.variants.includes(variantId))?.id ?? '';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ComponentViewUIProps {
  onPanelsChange: (panels: TimelinePanel[]) => void;
  onLoadingChange: (loading: boolean) => void;
}

// ---------------------------------------------------------------------------
// ComponentViewUI
// ---------------------------------------------------------------------------

export function ComponentViewUI({ onPanelsChange, onLoadingChange }: ComponentViewUIProps) {
  const theme = useTheme2();

  // Stage 1 — variants config (variant defs + ordered component ID list)
  const [variants, setVariants] = useState<VariantsConfig | null>(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  // Stage 2 — component configs (fetched in parallel, keyed by component ID)
  const [componentConfigs, setComponentConfigs] = useState<Record<string, ComponentConfig>>({});
  const componentConfigsRef = useRef(componentConfigs);
  useEffect(() => { componentConfigsRef.current = componentConfigs; });

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
  const panelCacheRef = useRef(panelCache);
  useEffect(() => { panelCacheRef.current = panelCache; });

  // URL sync gate — true after full initialization
  const [menuInitialized, setMenuInitialized] = useState(false);
  const firstUrlWriteRef = useRef(true);

  // -------------------------------------------------------------------------
  // Load component configs for the given IDs (fills cache, skips already-loaded)
  // -------------------------------------------------------------------------
  const loadComponentConfigs = useCallback(
    (componentIds: string[]): Promise<Record<string, ComponentConfig>> => {
      const missing = componentIds.filter((id) => !componentConfigsRef.current[id]);
      if (!missing.length) {
        return Promise.resolve(componentConfigsRef.current);
      }
      return Promise.all(missing.map((id) => fetchComponentConfig(id).then((cfg) => ({ id, cfg })))).then(
        (results) => {
          const patch: Record<string, ComponentConfig> = {};
          results.forEach(({ id, cfg }) => { patch[id] = cfg; });
          const merged = { ...componentConfigsRef.current, ...patch };
          setComponentConfigs(merged);
          return merged;
        }
      );
    },
    [] // stable — reads via ref
  );

  // -------------------------------------------------------------------------
  // Mount: fetch variants, then all component configs in parallel
  // -------------------------------------------------------------------------
  useEffect(() => {
    fetchVariantsConfig()
      .then((cfg) => {
        setVariants(cfg);

        const search = locationService.getSearch();
        const urlVariant = search.get('variant');
        const urlComponent = search.get('component');
        const urlCategory = search.get('category');

        const v0 = (urlVariant ? cfg.variants.find((v) => v.id === urlVariant) : null) ?? cfg.variants[0];
        setVariantKey(v0?.id ?? '');

        return loadComponentConfigs(cfg.components).then((configs) => {
          // Pick starting component: URL param, or first with a visible category in this variant
          const vId = v0?.id ?? '';
          const orderedCfgs = cfg.components.map((id) => configs[id]).filter(Boolean);
          const c0 =
            (urlComponent ? orderedCfgs.find((c) => c.id === urlComponent) : null) ??
            orderedCfgs.find((c) => c.categories.some((cat) => cat.variants.includes(vId)));
          setComponentKey(c0?.id ?? '');

          // Pick starting category: URL param, or first visible in this variant
          const cat0Id = urlCategory ?? (c0 ? firstVisibleCategory(c0, vId) : '');
          const cat0 = c0?.categories.find((c) => c.id === cat0Id && c.variants.includes(vId));
          setCategoryId(cat0?.id ?? (c0 ? firstVisibleCategory(c0, vId) : ''));

          setSubCategoryFilter(search.get('sub') ?? '');
          setOsFilter(search.get('os') ?? '');
          setSearchText(search.get('q') ?? '');
          setMenuInitialized(true);
        });
      })
      .catch((err: unknown) => {
        setMenuError(err instanceof Error ? err.message : 'Failed to load menu');
      })
      .finally(() => setMenuLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const componentConfig = componentConfigs[componentKey] ?? null;

  // Categories for the current component that are visible in the active variant
  const visibleCategories = useMemo(
    () => (componentConfig?.categories ?? []).filter((c) => c.variants.includes(variantKey)),
    [componentConfig, variantKey]
  );

  const categoryDef = visibleCategories.find((c) => c.id === categoryId) ?? null;

  // Active variant definition — carries CSPs for cloud-type variants
  const activeVariantDef = variants?.variants.find((v) => v.id === variantKey) ?? null;
  const variantCSPs = activeVariantDef?.csps ?? [];

  const variantOptions: Array<SelectableValue<string>> = useMemo(
    () => (variants?.variants ?? []).map((v) => ({ value: v.id, label: v.label })),
    [variants]
  );

  // Components visible in the active variant (have at least one category for it), sorted by order
  const visibleComponents = useMemo(() => {
    if (!variants) { return []; }
    return variants.components
      .map((id) => componentConfigs[id])
      .filter((cfg): cfg is ComponentConfig =>
        !!cfg && cfg.categories.some((c) => c.variants.includes(variantKey))
      );
  }, [variants, componentConfigs, variantKey]);

  const primaryComponents = useMemo(() => visibleComponents.filter((c) => c.primary), [visibleComponents]);
  const moreComponents = useMemo(() => visibleComponents.filter((c) => !c.primary), [visibleComponents]);
  const isMoreActive = moreComponents.some((c) => c.id === componentKey);

  const moreOptions: Array<SelectableValue<string>> = useMemo(
    () => moreComponents.map((c) => ({ value: c.id, label: c.title })),
    [moreComponents]
  );

  // -------------------------------------------------------------------------
  // Fetch panels when component+category change (uses dbComponents for the query)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!componentKey || !categoryId || !componentConfig) {
      return;
    }
    const key = cacheKey(variantKey, componentKey, categoryId);
    if (panelCacheRef.current[key] !== undefined) {
      return;
    }
    onLoadingChange(true);
    setPanelsLoading(true);
    fetchPanelsForView(dbComponentIDsForVariant(componentConfig, variantKey), categoryId)
      .then((panels) => {
        setPanelCache((prev) => ({ ...prev, [key]: panels }));
      })
      .catch((err: unknown) => {
        console.error('panel fetch failed', variantKey, componentKey, categoryId, err);
        setPanelCache((prev) => ({ ...prev, [key]: [] }));
      })
      .finally(() => {
        setPanelsLoading(false);
        onLoadingChange(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantKey, componentKey, categoryId]);

  // -------------------------------------------------------------------------
  // Derive visible panels (client-side filtering)
  // -------------------------------------------------------------------------
  const allPanels = panelCache[cacheKey(variantKey, componentKey, categoryId)] ?? null;

  const visiblePanels = useMemo(() => {
    if (!allPanels) { return null; }
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
    if (panelsLoading) { return; }
    onPanelsChange(visiblePanels ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePanels, panelsLoading]);

  // -------------------------------------------------------------------------
  // Selection handlers
  // -------------------------------------------------------------------------
  const selectVariant = useCallback(
    (vk: string) => {
      if (vk === variantKey || !variants) { return; }
      setVariantKey(vk);
      setSubCategoryFilter('');
      setOsFilter('');
      setSearchText('');

      // Keep the same component if it has visible categories in the new variant,
      // otherwise fall back to the first visible one.
      const configs = componentConfigsRef.current;
      const orderedCfgs = variants.components.map((id) => configs[id]).filter(Boolean) as ComponentConfig[];
      const currentCfg = configs[componentKey];
      const hasVisibleCats = currentCfg?.categories.some((c) => c.variants.includes(vk));

      const nextComp = hasVisibleCats
        ? currentCfg
        : orderedCfgs.find((c) => c.categories.some((cat) => cat.variants.includes(vk)));

      if (nextComp && nextComp.id !== componentKey) {
        setComponentKey(nextComp.id);
      }
      setCategoryId(nextComp ? firstVisibleCategory(nextComp, vk) : '');
    },
    [variantKey, componentKey, variants]
  );

  const selectComponent = useCallback(
    (ck: string) => {
      if (ck === componentKey) { return; }
      const cfg = componentConfigsRef.current[ck];
      setComponentKey(ck);
      setCategoryId(cfg ? firstVisibleCategory(cfg, variantKey) : '');
      setSubCategoryFilter('');
      setOsFilter('');
      setSearchText('');
    },
    [componentKey, variantKey]
  );

  const selectCategory = useCallback(
    (id: string) => {
      if (id === categoryId) { return; }
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
    return <div style={{ padding: sp(4), color: c.error.text }}>Menu unavailable: {menuError}</div>;
  }

  if (!variants) {
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
      {/* Row 1: variant select · primary component tabs · More overflow · OS · search · count */}
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

        {/* Primary component tabs */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <TabsBar>
            {primaryComponents.map((comp) => (
              <Tab
                key={comp.id}
                label={comp.title}
                active={!isMoreActive && componentKey === comp.id}
                onChangeTab={() => selectComponent(comp.id)}
              />
            ))}
          </TabsBar>
        </div>

        {/* More overflow */}
        {moreComponents.length > 0 && (
          <Select
            options={moreOptions}
            value={isMoreActive ? componentKey : null}
            onChange={(opt: SelectableValue<string>) => opt?.value && selectComponent(opt.value)}
            placeholder="More…"
            isClearable={false}
            width={16}
          />
        )}

        {/* CSP filter — shown for variants that carry fixed CSP values (e.g. cloud) */}
        {variantCSPs.length > 0 && (
          <Select
            options={[
              { value: '', label: 'All CSPs' },
              ...variantCSPs.map((csp) => ({ value: csp, label: csp })),
            ]}
            value={subCategoryFilter || ''}
            onChange={(opt: SelectableValue<string>) => setSubCategoryFilter(opt?.value ?? '')}
            width={14}
            isClearable={false}
          />
        )}

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

      {/* Row 2: category tabs (variant-filtered) */}
      {visibleCategories.length > 0 && (
        <div style={{ borderBottom: `1px solid ${c.border.weak}`, paddingBottom: sp(0.5) }}>
          <TabsBar>
            {visibleCategories.map((cat) => (
              <Tab
                key={cat.id}
                label={cat.title}
                active={categoryId === cat.id}
                onChangeTab={() => selectCategory(cat.id)}
              />
            ))}
          </TabsBar>
        </div>
      )}

      {/* Row 3 (conditional): subcategory pills — hidden when CSP Select is active */}
      {categoryDef && categoryDef.subCategories.length > 0 && variantCSPs.length === 0 && (
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
