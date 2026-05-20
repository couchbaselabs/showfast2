package db

import (
	"context"
)

const baseQuery = "FROM (SELECT b.`value`, b.`build`, m.`title`, m.component, m.category, m.subCategory, c.os, c.cpu, c.name FROM `benchmarks` as b JOIN `metrics` as m ON b.metric = m.id JOIN `clusters` as c ON m.`cluster` = c.name WHERE b.hidden = false AND m.hidden = false) as subquery "

type FilterOptions struct {
	Components    []string
	Categories    []string
	Subcategories []string
	Clusters      []string
	OS            []string
	Tags          map[string][]string
}

type GenericFilterSpec struct {
	column string
	param  string
	values func(FilterOptions) []string
}

var GenericFilterSpecs = []GenericFilterSpec{
	{
		column: "component",
		param:  "components",
		values: func(opts FilterOptions) []string { return opts.Components },
	},
	{
		column: "category",
		param:  "categories",
		values: func(opts FilterOptions) []string { return opts.Categories },
	},
	{
		column: "subCategory",
		param:  "subcategories",
		values: func(opts FilterOptions) []string { return opts.Subcategories },
	},
	{
		column: "os",
		param:  "os",
		values: func(opts FilterOptions) []string { return opts.OS },
	},
	{
		column: "name",
		param:  "clusters",
		values: func(opts FilterOptions) []string { return opts.Clusters },
	},
}

func (ds *DataStore) GenericFiltering(filter string, opts FilterOptions, c context.Context) ([]string, error) {
	column, err := normalizeGenericFilterColumn(filter)
	if err != nil {
		return nil, err
	}

	query := "SELECT DISTINCT RAW subquery." + column + " " + baseQuery + "WHERE subquery." + column + "!= \"\""
	params := make(map[string]interface{})
	query, params = addGenericFilterConditions(query, params, opts, map[string]string{
		"component":   "subquery.component",
		"category":    "subquery.category",
		"subCategory": "subquery.subCategory",
		"os":          "subquery.os",
		"name":        "subquery.name",
	}, map[string]bool{column: true})
	query += ` ORDER BY subquery.` + column
	return queryRows[string](ds.cluster, query, params, column, c)
}

func (ds *DataStore) GetComponents(opts FilterOptions, c context.Context) ([]string, error) {
	return ds.GenericFiltering("component", opts, c)
}
func (ds *DataStore) GetCategories(opts FilterOptions, c context.Context) ([]string, error) {
	return ds.GenericFiltering("category", opts, c)
}
func (ds *DataStore) GetSubcategories(opts FilterOptions, c context.Context) ([]string, error) {
	return ds.GenericFiltering("subCategory", opts, c)
}
func (ds *DataStore) GetOs(opts FilterOptions, c context.Context) ([]string, error) {
	return ds.GenericFiltering("os", opts, c)
}
func (ds *DataStore) GetClusters(opts FilterOptions, c context.Context) ([]string, error) {
	return ds.GenericFiltering("cluster", opts, c)
}

func (ds *DataStore) GetFilters(c context.Context) (*map[string][]string, error) {
	type tagDef struct {
		Key   string `json:"k"`
		Value string `json:"v"`
	}

	tagQuery := `
		SELECT k, v
		FROM metrics m
		UNNEST OBJECT_PAIRS(m.tags) AS entry
		LET k = entry.name,
		    v = entry.val
		WHERE m.hidden = False
		AND m.tags IS NOT NULL
		GROUP BY k, v
	`
	tagRows, err := queryRows[tagDef](ds.cluster, tagQuery, nil, "tag", c)
	if err != nil {
		return nil, err
	}

	tagMap := make(map[string]map[string]bool)
	for _, tag := range tagRows {
		if _, ok := tagMap[tag.Key]; !ok {
			tagMap[tag.Key] = make(map[string]bool)
		}
		tagMap[tag.Key][tag.Value] = true
	}

	tags := make(map[string][]string)
	for key, valueMap := range tagMap {
		values := make([]string, 0, len(valueMap))
		for value := range valueMap {
			values = append(values, value)
		}
		tags[key] = values
	}

	return &tags, nil
}
