package db

import (
	"context"
	"strings"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// filterQueryBase is the core join chain for filter DISTINCT queries, starting from
// metrics (the smallest table) so Couchbase can use the metrics hidden/component/category
// indexes to filter rows before joining the larger benchmarks collection.
const filterQueryBase = "FROM " + metricsKeyspace + " m " +
	"JOIN " + benchmarksKeyspace + " b ON KEY b.metric FOR m " +
	"JOIN " + runsKeyspace + " r ON KEYS b.runId "

const filterQueryClustersJoin = "JOIN " + clustersKeyspace + " c ON KEYS r.clusterId "

// osFilterExpr is the N1QL expression that computes the OS label from cluster data.
const osFilterExpr = "CASE WHEN c.os.distro IS NOT MISSING AND c.os.version IS NOT MISSING THEN c.os.distro || '-' || c.os.version WHEN c.os.distro IS NOT MISSING THEN c.os.distro ELSE TO_STRING(c.os) END"

// filterDirectColMap maps normalized column names to their table-qualified SQL expressions
// for use in direct-join filter queries (no subquery).
var filterDirectColMap = map[string]string{
	"component":        "m.component",
	"category":         "m.category",
	"subCategory":      "m.subCategory",
	"os":               osFilterExpr,
	"name":             "c.name",
	"pipelineGroup":    "b.pipelineGroup",
	"serverMajorMinor": "b.serverMajorMinor",
}

// columnsNeedingClusters lists the filter dimensions whose SQL expression references
// the clusters collection (requiring the clusters JOIN).
var columnsNeedingClusters = map[string]bool{
	"os":   true,
	"name": true,
}

type FilterOptions struct {
	Components           []string
	Categories           []string
	Subcategories        []string
	Clusters             []string
	OS                   []string
	PipelineGroups       []string
	ServerMajorMinors    []string
	Tags                 map[string][]string
	ShowHiddenMetrics    bool
	ShowHiddenBenchmarks bool
	TitleSearch          string
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

	key := filterCacheKey(column, opts)
	if cached, ok := ds.cache.get(key); ok {
		return cached, nil
	}

	colExpr := filterDirectColMap[column]

	// Include the clusters JOIN only when the queried dimension or an active
	// cross-filter references the clusters collection (avoids the expensive lookup
	// for the common case of querying component/category/serverMajorMinor).
	needsClusters := columnsNeedingClusters[column] || len(opts.OS) > 0 || len(opts.Clusters) > 0
	from := filterQueryBase
	if needsClusters {
		from += filterQueryClustersJoin
	}

	whereClauses := []string{`r.status = 'completed'`, colExpr + ` != ""`}
	if !opts.ShowHiddenMetrics {
		whereClauses = append(whereClauses, "m.hidden = false")
	}
	if !opts.ShowHiddenBenchmarks {
		whereClauses = append(whereClauses, "b.hidden = false")
	}

	query := "SELECT DISTINCT RAW " + colExpr + " " + from +
		"WHERE " + strings.Join(whereClauses, " AND ")
	params := make(map[string]interface{})

	for _, spec := range GenericFilterSpecs {
		if spec.column == column {
			continue
		}
		vals := spec.values(opts)
		if len(vals) == 0 {
			continue
		}
		query += " AND " + filterDirectColMap[spec.column] + " IN $" + spec.param
		params[spec.param] = vals
	}

	tagClause, tagParams := buildTagFilters(opts.Tags)
	query += tagClause
	for k, v := range tagParams {
		params[k] = v
	}

	query += " ORDER BY " + colExpr

	result, err := queryRows[string](ds.cluster, query, params, column, c)
	if err != nil {
		return nil, err
	}

	ds.cache.set(key, result)
	return result, nil
}

// WarmFilterCache pre-populates the cache with all 7 unfiltered filter dimensions.
// Subsequent cross-filter combinations are cached lazily on first access.
// Runs all queries concurrently since they are independent.
func (ds *DataStore) WarmFilterCache(ctx context.Context) {
	fns := []func(FilterOptions, context.Context) ([]string, error){
		ds.GetComponents,
		ds.GetCategories,
		ds.GetSubcategories,
		ds.GetOs,
		ds.GetClusters,
		ds.GetPipelineGroups,
		ds.GetServerMajorMinors,
	}
	var wg sync.WaitGroup
	for _, fn := range fns {
		wg.Add(1)
		go func(f func(FilterOptions, context.Context) ([]string, error)) {
			defer wg.Done()
			_, _ = f(FilterOptions{}, ctx)
		}(fn)
	}
	wg.Wait()
	log.DefaultLogger.Info("filter cache warmed")
}

// ReloadFilterCache clears the cache and re-warms it in the background.
func (ds *DataStore) ReloadFilterCache() {
	ds.cache.clear()
	go ds.WarmFilterCache(context.Background())
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

// BulkFilters holds all filter dimension values in a single response.
type BulkFilters struct {
	Components        []string `json:"component"`
	Categories        []string `json:"category"`
	Subcategories     []string `json:"subcategory"`
	Clusters          []string `json:"cluster"`
	OS                []string `json:"os"`
	PipelineGroups    []string `json:"pipelineGroup"`
	ServerMajorMinors []string `json:"serverMajorMinor"`
}

// GetFiltersBulk fetches all 7 filter dimensions concurrently and returns them in one struct.
// Cached dimensions are served from memory; cache misses run their N1QL query in parallel.
func (ds *DataStore) GetFiltersBulk(opts FilterOptions, ctx context.Context) (BulkFilters, error) {
	type entry struct {
		key string
		val []string
		err error
	}

	fetchers := []struct {
		key string
		fn  func(FilterOptions, context.Context) ([]string, error)
	}{
		{"component", ds.GetComponents},
		{"category", ds.GetCategories},
		{"subcategory", ds.GetSubcategories},
		{"cluster", ds.GetClusters},
		{"os", ds.GetOs},
		{"pipelineGroup", ds.GetPipelineGroups},
		{"serverMajorMinor", ds.GetServerMajorMinors},
	}

	ch := make(chan entry, len(fetchers))
	for _, f := range fetchers {
		f := f
		go func() {
			vals, err := f.fn(opts, ctx)
			ch <- entry{f.key, vals, err}
		}()
	}

	var bulk BulkFilters
	for range fetchers {
		e := <-ch
		if e.err != nil {
			return BulkFilters{}, e.err
		}
		switch e.key {
		case "component":
			bulk.Components = e.val
		case "category":
			bulk.Categories = e.val
		case "subcategory":
			bulk.Subcategories = e.val
		case "cluster":
			bulk.Clusters = e.val
		case "os":
			bulk.OS = e.val
		case "pipelineGroup":
			bulk.PipelineGroups = e.val
		case "serverMajorMinor":
			bulk.ServerMajorMinors = e.val
		}
	}

	return bulk, nil
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
