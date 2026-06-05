package db

import (
	"context"
	"regexp"
	"sort"
	"time"

	"github.com/cbperf/showfast/pkg/models"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

var validTagKey = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

func (ds *DataStore) GetMetrics(components []string, tags map[string][]string, c context.Context) ([]models.Metric, error) {
	queryStr := `SELECT m.* FROM ` + metricsKeyspace + ` m WHERE m.hidden = False`
	params := make(map[string]interface{})
	queryStr, params = addComponentAndTagFilterConditions(queryStr, params, components, tags)
	queryStr += ` ORDER BY m.category`
	return queryRows[models.Metric](ds.cluster, queryStr, params, "metric", c)
}

func (ds *DataStore) GetBenchmarks(components []string, tags map[string][]string, c context.Context) ([]models.Benchmark, error) {
	queryStr := "SELECT b.* FROM " + benchmarksKeyspace + " b JOIN " + metricsKeyspace + " m ON KEYS b.metric JOIN " + runsKeyspace + " r ON KEYS b.runId WHERE b.hidden = False AND r.status = 'completed'"
	params := make(map[string]interface{})
	queryStr, params = addComponentAndTagFilterConditions(queryStr, params, components, tags)

	queryStr += " ORDER BY b.dateTime DESC"
	return queryRows[models.Benchmark](ds.cluster, queryStr, params, "benchmark", c)
}

func (ds *DataStore) GetBuilds(c context.Context) ([]string, error) {
	query := "SELECT DISTINCT RAW b.version FROM " + buildsKeyspace + " b WHERE b.component = 'server'"
	results, err := queryRows[string](ds.cluster, query, nil, "build", c)
	if err != nil {
		return nil, err
	}

	sortBuildStringsDesc(results)
	return results, nil
}

func (ds *DataStore) GetTimeline(metricID string, c context.Context) (*[][]interface{}, error) {
	query := "SELECT RAW [b.`build`, b.`value`] FROM " + benchmarksKeyspace + " b JOIN " + runsKeyspace + " r ON KEYS b.runId WHERE b.metric = $metricID AND b.hidden = False AND r.status = 'completed'"
	params := map[string]interface{}{
		"metricID": metricID,
	}
	results, err := queryRows[[]interface{}](ds.cluster, query, params, "timeline row", c)
	if err != nil {
		return nil, err
	}

	sort.SliceStable(results, func(i, j int) bool {
		var buildI, buildJ string
		if len(results[i]) > 0 {
			if val, ok := results[i][0].(string); ok {
				buildI = val
			}
		}
		if len(results[j]) > 0 {
			if val, ok := results[j][0].(string); ok {
				buildJ = val
			}
		}

		return compareSemanticBuild(buildI, buildJ) > 0
	})

	return &results, nil
}

func (ds *DataStore) GetTimelinePanels(filters *FilterOptions, c context.Context) (*[]models.TimelinePanel, error) {
	type timelinePanelRow struct {
		models.TimelinePanel
		Build     string   `json:"build"`
		Value     float64  `json:"value"`
		BuildURL  string   `json:"buildUrl"`
		Snapshots []string `json:"snapshots"`
	}

	// Drive from metrics (small, filterable by component/category via idx_metrics_hidden_filters),
	// then find benchmarks via ON KEY b.metric FOR m (uses idx_benchmarks_metric_hidden).
	// This is much faster than the reverse: scanning all benchmarks then filtering on joined metric fields.
	query := "SELECT m.id AS metricId, m.`title` AS title, m.component AS component, m.category AS category, "
	query += "m.subCategory AS subCategory, r.clusterId AS `cluster`, m.tags AS tags, "
	query += "{\"name\": c.name, \"os\": CASE WHEN c.os.distro IS NOT MISSING AND c.os.version IS NOT MISSING THEN c.os.distro || '-' || c.os.version WHEN c.os.distro IS NOT MISSING THEN c.os.distro ELSE TO_STRING(c.os) END, \"cpu\": c.cpu, \"disk\": c.disk, \"memory\": c.memory} AS clusterInfo, "
	query += "b.`build` AS `build`, b.`value` AS `value`, r.`buildURL` AS `buildUrl`, b.`snapshots` AS snapshots "
	query += "FROM " + metricsKeyspace + " m "
	query += "JOIN " + benchmarksKeyspace + " b ON KEY b.metric FOR m "
	query += "JOIN " + runsKeyspace + " r ON KEYS b.runId "
	query += "JOIN " + clustersKeyspace + " c ON KEYS r.clusterId "
	query += "WHERE m.hidden = False AND b.hidden = False AND r.status = 'completed'"
	params := make(map[string]interface{})
	query, params = addGenericFilterConditions(query, params, *filters, map[string]string{
		"component":        "m.component",
		"category":         "m.category",
		"subCategory":      "m.subCategory",
		"name":             "c.name",
		"os":               "CASE WHEN c.os.distro IS NOT MISSING AND c.os.version IS NOT MISSING THEN c.os.distro || '-' || c.os.version WHEN c.os.distro IS NOT MISSING THEN c.os.distro ELSE TO_STRING(c.os) END",
		"pipelineGroup":    "b.pipelineGroup",
		"serverMajorMinor": "b.serverMajorMinor",
	}, nil)

	tagClause, tagParams := buildTagFilters(filters.Tags)
	query += tagClause
	for k, v := range tagParams {
		params[k] = v
	}

	query += " ORDER BY m.component, m.category, m.subCategory, m.title ASC"

	queryStart := time.Now()
	results, err := queryRows[timelinePanelRow](ds.cluster, query, params, "timeline panel", c)
	queryMs := time.Since(queryStart).Milliseconds()
	if err != nil {
		return nil, err
	}

	aggStart := time.Now()
	panelMap := make(map[string]*models.TimelinePanel)
	panelOrder := make([]string, 0)
	for _, row := range results {
		panel, exists := panelMap[row.MetricID]
		if !exists {
			panel = &row.TimelinePanel
			panel.BenchmarksValues = make([]models.TimelinePoint, 0)
			panelMap[row.MetricID] = panel
			panelOrder = append(panelOrder, row.MetricID)
		}
		panel.BenchmarksValues = append(panel.BenchmarksValues, models.TimelinePoint{
			Build:     row.Build,
			Value:     row.Value,
			BuildURL:  row.BuildURL,
			Snapshots: row.Snapshots,
		})
	}

	totalPoints := 0
	panels := make([]models.TimelinePanel, 0, len(panelOrder))
	for _, metricID := range panelOrder {
		pts := panelMap[metricID].BenchmarksValues
		keys := make([][4]int, len(pts))
		for i, pt := range pts {
			keys[i], _ = parseSemanticBuild(pt.Build)
		}
		sort.SliceStable(pts, func(i, j int) bool {
			ki, kj := keys[i], keys[j]
			if ki[0] != kj[0] {
				return ki[0] > kj[0]
			}
			if ki[1] != kj[1] {
				return ki[1] > kj[1]
			}
			if ki[2] != kj[2] {
				return ki[2] > kj[2]
			}
			return ki[3] > kj[3]
		})
		totalPoints += len(pts)
		panels = append(panels, *panelMap[metricID])
	}
	aggMs := time.Since(aggStart).Milliseconds()

	log.DefaultLogger.Info("GetTimelinePanels",
		"rows", len(results),
		"panels", len(panels),
		"totalPoints", totalPoints,
		"queryMs", queryMs,
		"aggMs", aggMs,
	)

	return &panels, nil
}

func (ds *DataStore) GetAllRuns(metricID string, build string, c context.Context) ([]models.Run, error) {
	query := "SELECT DISTINCT RAW r FROM " + benchmarksKeyspace + " b JOIN " + runsKeyspace + " r ON KEYS b.runId WHERE b.metric = $metricID AND b.`build` = $build AND r.status = 'completed' ORDER BY r.dateTime DESC"
	params := map[string]interface{}{
		"metricID": metricID,
		"build":    build,
	}
	return queryRows[models.Run](ds.cluster, query, params, "run", c)
}

func (ds *DataStore) GetClusterInfo(clusterID string, c context.Context) (*models.Cluster, error) {
	query := "SELECT c.* FROM " + clustersKeyspace + " c USE KEYS $clusterID"
	params := map[string]interface{}{
		"clusterID": clusterID,
	}
	results, err := queryRows[models.Cluster](ds.cluster, query, params, "cluster", c)
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, nil
	}
	return &results[0], nil
}
