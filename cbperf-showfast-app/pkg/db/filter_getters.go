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

	for _, spec := range GenericFilterSpecs {
		// Skip self-filtering so the options list for the active dimension can expand.
		if spec.column == column {
			continue
		}
		query, params = addFilterCondition(query, params, "subquery."+spec.column, spec.param, spec.values(opts))
	}
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
