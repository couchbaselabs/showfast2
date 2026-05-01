package db

import (
	"context"
	"regexp"

	"github.com/cbperf/showfast/pkg/models"
)

var validTagKey = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

func (ds *DataStore) GetMetrics(components []string, tags map[string][]string, c context.Context) ([]models.Metric, error) {
	queryStr := `SELECT m.* FROM metrics m WHERE m.hidden = False`
	params := make(map[string]interface{})

	if len(components) > 0 {
		queryStr += ` AND m.component IN $components`
		params["components"] = components
	}

	tagClause, tagParams := buildTagFilters(tags)
	queryStr += tagClause
	for k, v := range tagParams {
		params[k] = v
	}
	queryStr += ` ORDER BY m.category`
	return queryRows[models.Metric](ds.cluster, queryStr, params, "metric", c)
}

func (ds *DataStore) GetBenchmarks(components []string, tags map[string][]string, c context.Context) ([]models.Benchmark, error) {
	queryStr := "SELECT b.* FROM benchmarks b JOIN metrics m ON KEYS b.metric WHERE b.hidden = False"
	params := make(map[string]interface{})

	if len(components) > 0 {
		queryStr += ` AND m.component IN $components`
		params["components"] = components
	}

	tagClause, tagParams := buildTagFilters(tags)
	queryStr += tagClause
	for k, v := range tagParams {
		params[k] = v
	}

	queryStr += " ORDER BY b.dateTime DESC"
	return queryRows[models.Benchmark](ds.cluster, queryStr, params, "benchmark", c)
}

func (ds *DataStore) GetBuilds(c context.Context) ([]string, error) {
	query := "SELECT DISTINCT RAW b.`build` FROM benchmarks b WHERE b.hidden = False ORDER BY SPLIT(b.`build`, \"-\")[0] DESC, SPLIT(b.`build`, \"-\")[1] DESC"
	return queryRows[string](ds.cluster, query, nil, "build", c)
}

func (ds *DataStore) GetTimeline(metricID string, c context.Context) (*[][]interface{}, error) {
	query := "SELECT RAW [b.`build`, b.`value`] FROM benchmarks b WHERE b.metric = $metricID AND b.hidden = False ORDER BY SPLIT(b.`build`, \"-\")[0] DESC, SPLIT(b.`build`, \"-\")[1] DESC"
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
	query := "SELECT b.* FROM benchmarks b WHERE b.metric = $metricID AND b.`build` = $build ORDER BY b.dateTime DESC"
	params := map[string]interface{}{
		"metricID": metricID,
		"build":    build,
	}
	return queryRows[models.Run](ds.cluster, query, params, "run", c)
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
