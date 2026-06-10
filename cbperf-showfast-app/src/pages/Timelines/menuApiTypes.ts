/** Frontend types mirroring pkg/models/menu.go */

export interface VariantDef {
  id: string;
  label: string;
  /** Fixed CSP values for cloud-type variants (e.g. ["AWS","GCP","AZURE"]). Absent for on-prem. */
  csps?: string[];
}

/** Shape of cbmonitor:variants */
export interface VariantsConfig {
  variants: VariantDef[];
  /** Ordered list of component IDs to load */
  components: string[];
}

export interface CategoryDef {
  id: string;
  title: string;
  subCategories: string[];
  /** Variant IDs this category is visible under, e.g. ["on-prem", "cloud"] */
  variants: string[];
}

/** Shape of cbmonitor:component:{id} */
export interface ComponentConfig {
  id: string;
  title: string;
  order: number;
  /** true → shown in the main tab row; false → "More" overflow */
  primary: boolean;
  /**
   * Actual metric.component values to query across all variants.
   * Present during the on-prem/cloud data migration period. Absent once unified.
   */
  dbComponents?: string[];
  /**
   * Per-variant DB component IDs. When present, use these instead of dbComponents
   * so each variant queries only its own data (e.g. on-prem=["kv"], cloud=["kvcloud"]).
   */
  variantComponents?: Record<string, string[]>;
  categories: CategoryDef[];
}

/** Returns the DB-level component IDs for a specific variant. */
export function dbComponentIDsForVariant(comp: ComponentConfig, variantId: string): string[] {
  // Explicit per-variant mapping takes precedence.
  if (comp.variantComponents?.[variantId]?.length) {
    return comp.variantComponents[variantId];
  }
  const all = comp.dbComponents?.length ? comp.dbComponents : [comp.id];
  if (all.length === 1) {
    // Single DB component — no ambiguity regardless of variant.
    return all;
  }
  // Transition-period heuristic: cloud DB components carry a "cloud" suffix.
  // This separates on-prem and cloud panels without requiring variantComponents docs.
  if (variantId === 'cloud') {
    const cloud = all.filter((c) => c.toLowerCase().endsWith('cloud'));
    if (cloud.length > 0) { return cloud; }
  } else {
    const onPrem = all.filter((c) => !c.toLowerCase().endsWith('cloud'));
    if (onPrem.length > 0) { return onPrem; }
  }
  return all;
}

/** Returns all DB-level component IDs (across all variants). Used for warming. */
export function dbComponentIDs(comp: ComponentConfig): string[] {
  return comp.dbComponents && comp.dbComponents.length > 0 ? comp.dbComponents : [comp.id];
}
