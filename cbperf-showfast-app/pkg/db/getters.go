package db

import (
	"context"
	"regexp"
	"sort"

	"github.com/cbperf/showfast/pkg/models"
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

	query := "SELECT m.id AS metricId, m.`title` AS title, m.component AS component, m.category AS category, "
	query += "m.subCategory AS subCategory, r.clusterId AS `cluster`, m.tags AS tags, "
	query += "{\"name\": c.name, \"os\": CASE WHEN c.os.distro IS NOT MISSING AND c.os.version IS NOT MISSING THEN c.os.distro || '-' || c.os.version WHEN c.os.distro IS NOT MISSING THEN c.os.distro ELSE TO_STRING(c.os) END, \"cpu\": c.cpu, \"disk\": c.disk, \"memory\": c.memory} AS clusterInfo, "
	query += "b.`build` AS `build`, b.`value` AS `value`, r.`buildURL` AS `buildUrl` , b.`snapshots` as snapshots "
	query += "FROM " + benchmarksKeyspace + " b JOIN " + runsKeyspace + " r ON KEYS b.runId JOIN " + metricsKeyspace + " m ON KEYS b.metric JOIN " + clustersKeyspace + " c ON KEYS r.clusterId "
	query += "WHERE b.hidden = False AND m.hidden = False AND r.status = 'completed'"
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
	results, err := queryRows[timelinePanelRow](ds.cluster, query, params, "timeline panel", c)
	if err != nil {
		return nil, err
	}

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

	panels := make([]models.TimelinePanel, 0, len(panelOrder))
	for _, metricID := range panelOrder {
		sort.SliceStable(panelMap[metricID].BenchmarksValues, func(i, j int) bool {
			return compareSemanticBuild(panelMap[metricID].BenchmarksValues[i].Build, panelMap[metricID].BenchmarksValues[j].Build) > 0
		})
		panels = append(panels, *panelMap[metricID])
	}

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
