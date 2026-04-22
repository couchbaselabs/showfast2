package db

import (
	"fmt"
	"regexp"

	"github.com/cbperf/showfast/pkg/models"
	"github.com/couchbase/gocb/v2"
)

var validTagKey = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

func (ds *DataStore) GetMetrics(component string, tags map[string]string) ([]models.Metric, error) {
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
	results, err := ds.cluster.Query(queryStr, &gocb.QueryOptions{NamedParameters: params})
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

func (ds *DataStore) GetBenchmarks(component string, tags map[string]string) ([]models.Benchmark, error) {
	var benchmarks []models.Benchmark
	queryStr := `
		SELECT b.build, b.id, b.hidden, b.metric, b.value 
		FROM metrics m 
		JOIN benchmarks b ON KEY b.metric FOR m 
		WHERE m.component = $component AND b.hidden = False
	`
	params := map[string]interface{}{
		"component": component,
	}

	tagClause, tagParams := buildTagFilters(tags)
	queryStr += tagClause
	for k, v := range tagParams {
		params[k] = v
	}
	results, err := ds.cluster.Query(queryStr, &gocb.QueryOptions{NamedParameters: params})
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

func (ds *DataStore) GetBuilds() ([]string, error) {
	query := `
		SELECT DISTINCT RAW b.build
		FROM benchmarks b
		WHERE b.hidden = False
		ORDER BY SPLIT(b.build, "-")[0] DESC, SPLIT(b.build, "-")[1] DESC
	`
	return queryRows[string](ds.cluster, query, nil, "build")
}

func (ds *DataStore) GetTimeline(metricID string) (*[][]interface{}, error) {
	query := `
		SELECT b.build, b.value FROM benchmarks b
		WHERE b.metric = $metricID AND b.hidden = False
		ORDER BY SPLIT(b.build, "-")[0] DESC, SPLIT(b.build, "-")[1] DESC
	`
	params := map[string]interface{}{
		"metricID": metricID,
	}
	results, err := queryRows[[]interface{}](ds.cluster, query, params, "timeline row")
	if err != nil {
		return nil, err
	}
	return &results, nil
}

func (ds *DataStore) GetAllRuns(metricID string, build string) ([]models.Run, error) {
	query := `
		SELECT b.*
		FROM benchmarks b
		WHERE b.metric = $metricID AND b.build = $build
		ORDER BY b.dateTime DESC
	`
	params := map[string]interface{}{
		"metricID": metricID,
		"build":    build,
	}
	return queryRows[models.Run](ds.cluster, query, params, "run")
}

func (ds *DataStore) GetClusters(name string) ([]models.Cluster, error) {
	query := `SELECT c.* FROM clusters c WHERE ($name = "" OR c.name = $name)`
	params := map[string]interface{}{"name": name}
	return queryRows[models.Cluster](ds.cluster, query, params, "cluster")
}

type FilterResponse struct {
	Components []string            `json:"components"`
	Tags       map[string][]string `json:"tags"`
}

func (ds *DataStore) GetFilters() (*FilterResponse, error) {
	componentQuery := `SELECT DISTINCT RAW m.component FROM metrics m WHERE m.hidden = False ORDER BY m.component`
	components, err := queryRows[string](ds.cluster, componentQuery, nil, "component")
	if err != nil {
		return nil, err
	}

	type tagDef struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}

	tagQuery := `
		SELECT {
			"key": k,
			"value": v
		} AS tag
		FROM metrics m
		UNNEST OBJECT_ENTRIES(m.tags) AS entry
		LET k = entry.name,
		    v = entry.val
		WHERE m.hidden = False
		AND m.tags IS NOT NULL
		GROUP BY k, v
	`
	tagRows, err := queryRows[tagDef](ds.cluster, tagQuery, nil, "tag")
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
