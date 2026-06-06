package models

// MenuConfig is the shape of the cbmonitor:menu_config document in
// showfast._default._default. Admin edits that document to add or rename
// variants, components, and categories — no code change required.
// Array order controls display order in the UI.
//
// Example document:
//
//	{
//	  "variants": [
//	    { "id": "server", "label": "On-Prem", "components": [
//	        { "id": "kv", "title": "KV", "categories": [...] }
//	    ]},
//	    { "id": "cloud", "label": "Cloud", "components": [...] }
//	  ]
//	}
type MenuConfig struct {
	Variants []MenuVariant `json:"variants"`
}

// MenuVariant groups a named set of components (e.g. "server" or "cloud").
// The frontend renders a variant selector that swaps the full component list.
type MenuVariant struct {
	ID         string         `json:"id"`
	Label      string         `json:"label"`
	Components []ComponentDef `json:"components"`
}

type ComponentDef struct {
	ID         string        `json:"id"`
	Title      string        `json:"title"`
	Categories []CategoryDef `json:"categories"`
}

type CategoryDef struct {
	ID            string   `json:"id"`
	Title         string   `json:"title"`
	SubCategories []string `json:"subCategories"`
}
