package db

import (
	"context"
)

const baseQuery = "FROM (SELECT b.`value`, b.`build`, b.pipelineGroup, b.serverMajorMinor, m.`title`, m.component, m.category, m.subCategory, CASE WHEN c.os.distro IS NOT MISSING AND c.os.version IS NOT MISSING THEN c.os.distro || '-' || c.os.version WHEN c.os.distro IS NOT MISSING THEN c.os.distro ELSE TO_STRING(c.os) END AS os, c.cpu, c.name FROM " + benchmarksKeyspace + " b JOIN " + runsKeyspace + " r ON KEYS b.runId JOIN " + metricsKeyspace + " m ON KEYS b.metric JOIN " + clustersKeyspace + " c ON KEYS r.clusterId WHERE b.hidden = false AND m.hidden = false AND r.status = 'completed') as subquery "

type FilterOptions struct {
	Components        []string
	Categories        []string
	Subcategories     []string
	Clusters          []string
	OS                []string
	PipelineGroups    []string
	ServerMajorMinors []string
	Tags              map[string][]string
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
	{
		column: "pipelineGroup",
		param:  "pipelineGroups",
		values: func(opts FilterOptions) []string { return opts.PipelineGroups },
	},
	{
		column: "serverMajorMinor",
		param:  "serverMajorMinors",
		values: func(opts FilterOptions) []string { return opts.ServerMajorMinors },
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
		"component":        "subquery.component",
		"category":         "subquery.category",
		"subCategory":      "subquery.subCategory",
		"os":               "subquery.os",
		"name":             "subquery.name",
		"pipelineGroup":    "subquery.pipelineGroup",
		"serverMajorMinor": "subquery.serverMajorMinor",
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
func (ds *DataStore) GetPipelineGroups(opts FilterOptions, c context.Context) ([]string, error) {
	return ds.GenericFiltering("pipelineGroup", opts, c)
}
func (ds *DataStore) GetServerMajorMinors(opts FilterOptions, c context.Context) ([]string, error) {
	return ds.GenericFiltering("serverMajorMinor", opts, c)
}

func (ds *DataStore) GetFilters(c context.Context) (*map[string][]string, error) {
	type tagDef struct {
		Key   string `json:"k"`
		Value string `json:"v"`
	}

	tagQuery := `
		SELECT k, v
		FROM ` + metricsKeyspace + ` m
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

	tags := make(map[string][]string)
	for _, tag := range tagRows {
		tags[tag.Key] = append(tags[tag.Key], tag.Value)
	}

	return &tags, nil
}
