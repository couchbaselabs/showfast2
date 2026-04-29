package db

import (
	"context"
	"fmt"
	"regexp"

	"github.com/cbperf/showfast/pkg/models"
	"github.com/couchbase/gocb/v2"
)

var validTagKey = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

func (ds *DataStore) GetMetrics(component string, tags map[string]string, c context.Context) ([]models.Metric, error) {
	var metrics []models.Metric
	queryStr := `SELECT m.* FROM metrics m WHERE m.hidden = False`
	params := make(map[string]interface{})

	if component != "" {
		queryStr += ` AND m.component = $component`
		params["component"] = component
	}

	tagClause, tagParams := buildTagFilters(tags)
	queryStr += tagClause
	for k, v := range tagParams {
		params[k] = v
	}
	queryStr += ` ORDER BY m.category`
	results, err := ds.cluster.Query(queryStr, &gocb.QueryOptions{NamedParameters: params, Context: c})
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %v", err)
	}
	defer results.Close()

	for results.Next() {
		var row models.Metric
		if err := results.Row(&row); err == nil {
			metrics = append(metrics, row)
		}
	}
	if err := results.Err(); err != nil {
		return nil, fmt.Errorf("error reading query results: %v", err)
	}

	return metrics, nil
}

func (ds *DataStore) GetBenchmarks(component string, tags map[string]string, c context.Context) ([]models.Benchmark, error) {
	var benchmarks []models.Benchmark
	queryStr := "SELECT b.`build`, b.id, b.hidden, b.metric, b.`value` \n\t\tFROM benchmarks b \n\t\tJOIN metrics m ON KEYS b.metric \n\t\tWHERE m.component = $component AND b.hidden = False"
	params := map[string]interface{}{
		"component": component,
	}

	tagClause, tagParams := buildTagFilters(tags)
	queryStr += tagClause
	for k, v := range tagParams {
		params[k] = v
	}
	results, err := ds.cluster.Query(queryStr, &gocb.QueryOptions{NamedParameters: params, Context: c})
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %v", err)
	}
	defer results.Close()

	for results.Next() {
		var row models.Benchmark
		if err := results.Row(&row); err == nil {
			benchmarks = append(benchmarks, row)
		}
	}
	if err := results.Err(); err != nil {
		return nil, fmt.Errorf("error reading query results: %v", err)
	}

	return benchmarks, nil
}

func (ds *DataStore) GetBuilds(c context.Context) ([]string, error) {
	query := "\n\t\tSELECT DISTINCT RAW b.`build`\n\t\tFROM benchmarks b\n\t\tWHERE b.hidden = False\n\t\tORDER BY SPLIT(b.`build`, \"-\")[0] DESC, SPLIT(b.`build`, \"-\")[1] DESC\n\t"
	return queryRows[string](ds.cluster, query, nil, "build", c)
}

func (ds *DataStore) GetTimeline(metricID string, c context.Context) (*[][]interface{}, error) {
	query := "\n\t\tSELECT RAW [b.`build`, b.value] FROM benchmarks b\n\t\tWHERE b.metric = $metricID AND b.hidden = False\n\t\tORDER BY SPLIT(b.`build`, \"-\")[0] DESC, SPLIT(b.`build`, \"-\")[1] DESC\n\t"
	params := map[string]interface{}{
		"metricID": metricID,
	}
	results, err := queryRows[[]interface{}](ds.cluster, query, params, "timeline row", c)
	if err != nil {
		return nil, err
	}
	return &results, nil
}

func (ds *DataStore) GetAllRuns(metricID string, build string, c context.Context) ([]models.Run, error) {
	query := "\n\t\tSELECT b.*\n\t\tFROM benchmarks b\n\t\tWHERE b.metric = $metricID AND b.`build` = $build\n\t\tORDER BY b.dateTime DESC\n\t"
	params := map[string]interface{}{
		"metricID": metricID,
		"build":    build,
	}
	return queryRows[models.Run](ds.cluster, query, params, "run", c)
}

func (ds *DataStore) GetClusters(name string, c context.Context) ([]models.Cluster, error) {
	query := `SELECT c.* FROM clusters c WHERE ($name = "" OR c.name = $name)`
	params := map[string]interface{}{"name": name}
	return queryRows[models.Cluster](ds.cluster, query, params, "cluster", c)
}

type FilterResponse struct {
	Components []string            `json:"components"`
	Tags       map[string][]string `json:"tags"`
}

func (ds *DataStore) GetFilters(c context.Context) (*FilterResponse, error) {
	componentQuery := `SELECT DISTINCT RAW m.component FROM metrics m WHERE m.hidden = False ORDER BY m.component`
	components, err := queryRows[string](ds.cluster, componentQuery, nil, "component", c)
	if err != nil {
		return nil, err
	}

	type tagDef struct {
		Key   string `json:"key"`
		Value string `json:"value"`
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

	return &FilterResponse{
		Components: components,
		Tags:       tags,
	}, nil
}
