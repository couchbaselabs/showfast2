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
	query := "SELECT DISTINCT RAW b.`build` FROM benchmarks b WHERE b.hidden = False ORDER BY " + semanticBuildOrder("b.`build`", "DESC")
	return queryRows[string](ds.cluster, query, nil, "build", c)
}

func (ds *DataStore) GetTimeline(metricID string, c context.Context) (*[][]interface{}, error) {
	query := "SELECT RAW [b.`build`, b.`value`] FROM benchmarks b WHERE b.metric = $metricID AND b.hidden = False ORDER BY " + semanticBuildOrder("b.`build`", "DESC")
	params := map[string]interface{}{
		"metricID": metricID,
	}
	results, err := queryRows[[]interface{}](ds.cluster, query, params, "timeline row", c)
	if err != nil {
		return nil, err
	}
	return &results, nil
}

func (ds *DataStore) GetTimelinePanels(filters *FilterOptions, c context.Context) (*[]models.TimelinePanel, error) {
	type timelinePanelRow struct {
		MetricID    string            `json:"metricId"`
		Title       string            `json:"title"`
		Component   string            `json:"component"`
		Category    string            `json:"category"`
		SubCategory string            `json:"subCategory"`
		ClusterID   string            `json:"cluster"`
		Tags        map[string]string `json:"tags,omitempty"`
		ClusterName string            `json:"clusterName"`
		ClusterOS   string            `json:"clusterOS"`
		ClusterCPU  string            `json:"clusterCPU"`
		ClusterDisk string            `json:"clusterDisk"`
		ClusterMem  string            `json:"clusterMemory"`
		Build       string            `json:"build"`
		Value       float64           `json:"value"`
	}

	query := "SELECT m.id AS metricId, m.`title` AS title, m.component AS component, m.category AS category, "
	query += "m.subCategory AS subCategory, m.`cluster` AS `cluster`, m.tags AS tags, "
	query += "c.name AS clusterName, c.os AS clusterOS, c.cpu AS clusterCPU, c.disk AS clusterDisk, c.memory AS clusterMemory, "
	query += "b.`build` AS `build`, b.`value` AS `value` "
	query += "FROM metrics m JOIN benchmarks b ON m.id = b.metric JOIN `clusters` c ON c.name = m.`cluster` "
	query += "WHERE b.hidden = False AND m.hidden = False"
	params := make(map[string]interface{})

	if len(filters.Components) > 0 {
		query += " AND m.component IN $components"
		params["components"] = filters.Components
	}
	if len(filters.Categories) > 0 {
		query += " AND m.category IN $categories"
		params["categories"] = filters.Categories
	}
	if len(filters.Subcategories) > 0 {
		query += " AND m.subCategory IN $subcategories"
		params["subcategories"] = filters.Subcategories
	}
	if len(filters.Clusters) > 0 {
		query += " AND m.cluster IN $clusters"
		params["clusters"] = filters.Clusters
	}
	if len(filters.OS) > 0 {
		query += " AND c.os IN $os"
		params["os"] = filters.OS
	}

	tagClause, tagParams := buildTagFilters(filters.Tags)
	query += tagClause
	for k, v := range tagParams {
		params[k] = v
	}

	query += " ORDER BY m.component, m.category, m.subCategory, m.title ASC, " + semanticBuildOrder("b.`build`", "DESC")
	results, err := queryRows[timelinePanelRow](ds.cluster, query, params, "timeline panel", c)
	if err != nil {
		return nil, err
	}

	panelMap := make(map[string]*models.TimelinePanel)
	panelOrder := make([]string, 0)
	for _, row := range results {
		panel, exists := panelMap[row.MetricID]
		if !exists {
			panel = &models.TimelinePanel{
				MetricID:         row.MetricID,
				Title:            row.Title,
				Component:        row.Component,
				Category:         row.Category,
				SubCategory:      row.SubCategory,
				ClusterID:        row.ClusterID,
				ClusterInfo:      &models.Cluster{Name: row.ClusterName, OS: row.ClusterOS, CPU: row.ClusterCPU, Disk: row.ClusterDisk, Memory: row.ClusterMem},
				Tags:             row.Tags,
				BenchmarksValues: make([]models.TimelinePoint, 0),
			}
			panelMap[row.MetricID] = panel
			panelOrder = append(panelOrder, row.MetricID)
		}
		panel.BenchmarksValues = append(panel.BenchmarksValues, models.TimelinePoint{
			Build: row.Build,
			Value: row.Value,
		})
	}

	panels := make([]models.TimelinePanel, 0, len(panelOrder))
	for _, metricID := range panelOrder {
		panels = append(panels, *panelMap[metricID])
	}

	return &panels, nil
}

func (ds *DataStore) GetAllRuns(metricID string, build string, c context.Context) ([]models.Run, error) {
	query := "SELECT b.* FROM benchmarks b WHERE b.metric = $metricID AND b.`build` = $build ORDER BY b.dateTime DESC"
	params := map[string]interface{}{
		"metricID": metricID,
		"build":    build,
	}
	return queryRows[models.Run](ds.cluster, query, params, "run", c)
}

func (ds *DataStore) GetClusterInfo(name string, c context.Context) (*models.Cluster, error) {
	query := "SELECT c.* FROM clusters c WHERE c.name = $name"
	params := map[string]interface{}{
		"name": name,
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
