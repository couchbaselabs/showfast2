package models

// VariantsConfig is the shape of the cbmonitor:variants document.
// It declares the available variants and the ordered list of component IDs
// to load. Component details (categories, ordering, overflow flag) live in
// per-component documents (cbmonitor:component:{id}).
type VariantsConfig struct {
	Variants   []VariantDef `json:"variants"`
	Components []string     `json:"components"`
}

type VariantDef struct {
	ID    string   `json:"id"`
	Label string   `json:"label"`
	CSPs  []string `json:"csps,omitempty"`
}

// ComponentConfig is the shape of a cbmonitor:component:{id} document.
// It owns ordering, overflow classification, and the full category list.
// DBComponents lists all metric.component values for this component across variants.
// VariantComponents maps each variant ID to its specific DB component IDs, enabling
// variant-aware queries (e.g. on-prem → ["kv"], cloud → ["kvcloud"]).
type ComponentConfig struct {
	ID               string              `json:"id"`
	Title            string              `json:"title"`
	Order            int                 `json:"order"`
	Primary          bool                `json:"primary"`
	DBComponents     []string            `json:"dbComponents,omitempty"`
	VariantComponents map[string][]string `json:"variantComponents,omitempty"`
	Categories       []CategoryDef       `json:"categories"`
}

// DBComponentIDs returns all DB-level component IDs (across all variants).
// Used for panel cache warming. Falls back to the component's own ID when unset.
func (c ComponentConfig) DBComponentIDs() []string {
	if len(c.DBComponents) > 0 {
		return c.DBComponents
	}
	return []string{c.ID}
}

// DBComponentIDsForVariant returns the DB component IDs to query for a specific
// variant. Falls back to DBComponentIDs when VariantComponents is not configured.
func (c ComponentConfig) DBComponentIDsForVariant(variantID string) []string {
	if c.VariantComponents != nil {
		if ids, ok := c.VariantComponents[variantID]; ok && len(ids) > 0 {
			return ids
		}
	}
	return c.DBComponentIDs()
}

// CategoryDef describes one category within a component.
// Variants lists which variant IDs this category is visible under.
type CategoryDef struct {
	ID            string   `json:"id"`
	Title         string   `json:"title"`
	SubCategories []string `json:"subCategories"`
	Variants      []string `json:"variants"`
}
