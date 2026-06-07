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
// DBComponents lists the actual metric.component values to query for this
// component during the on-prem/cloud data migration period. Once all data
// carries a variant field, this can be removed.
type ComponentConfig struct {
	ID           string        `json:"id"`
	Title        string        `json:"title"`
	Order        int           `json:"order"`
	Primary      bool          `json:"primary"`
	DBComponents []string      `json:"dbComponents,omitempty"`
	Categories   []CategoryDef `json:"categories"`
}

// DBComponentIDs returns the DB-level component IDs to query. Falls back to
// the component's own ID when DBComponents is not set.
func (c ComponentConfig) DBComponentIDs() []string {
	if len(c.DBComponents) > 0 {
		return c.DBComponents
	}
	return []string{c.ID}
}

// CategoryDef describes one category within a component.
// Variants lists which variant IDs this category is visible under.
type CategoryDef struct {
	ID            string   `json:"id"`
	Title         string   `json:"title"`
	SubCategories []string `json:"subCategories"`
	Variants      []string `json:"variants"`
}
