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
   * Actual metric.component values to query. Present during the on-prem/cloud
   * data migration period (e.g. ["kv","kvcloud"]). Absent once data is unified.
   */
  dbComponents?: string[];
  categories: CategoryDef[];
}

/** Returns the DB-level component IDs to use when fetching panels. */
export function dbComponentIDs(comp: ComponentConfig): string[] {
  return comp.dbComponents && comp.dbComponents.length > 0 ? comp.dbComponents : [comp.id];
}
