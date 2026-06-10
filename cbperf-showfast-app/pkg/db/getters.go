package db

import (
	"context"
	"regexp"
	"sort"
	"strings"
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

	buildParseCache := make(map[string]semanticBuildParse)
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

		return compareSemanticBuildCached(buildI, buildJ, buildParseCache) > 0
	})

	return &results, nil
}

// hasBenchmarkDrivenFilters reports whether only benchmark-side filters (pipelineGroup,
// serverMajorMinor) are active with no metric-side constraints (component, category,
// subcategory, title search, or tags). When true, driving the query from benchmarks
// and using idx_benchmarks_pipelinegroup_hidden is far more efficient than scanning
// all metrics and filtering their benchmarks after the join.
func hasBenchmarkDrivenFilters(filters *FilterOptions) bool {
	hasMetricFilters := len(filters.Components) > 0 || len(filters.Categories) > 0 ||
		len(filters.Subcategories) > 0 || filters.TitleSearch != "" || len(filters.Tags) > 0
	hasBenchmarkFilters := len(filters.PipelineGroups) > 0 || len(filters.ServerMajorMinors) > 0
	return !hasMetricFilters && hasBenchmarkFilters
}

func (ds *DataStore) GetTimelinePanels(filters *FilterOptions, c context.Context) (*[]models.TimelinePanel, error) {
	if isPureViewQuery(filters) {
		key := panelCacheKey(filters.Components[0], filters.Categories[0])
		if cached, ok := ds.panels.get(key); ok {
			return &cached, nil
		}
	}

	type timelinePanelRow struct {
		models.TimelinePanel
		Build     string   `json:"build"`
		Value     float64  `json:"value"`
		BuildURL  string   `json:"buildUrl"`
		Snapshots []string `json:"snapshots"`
		RunID     string   `json:"runId"`
	}

	// Choose the driving collection based on the active filters:
	// - Metrics-first (default): efficient when component/category/title filters narrow metrics early.
	// - Benchmarks-first: used when only benchmark-side filters (pipelineGroup, serverMajorMinor) are
	//   active and no metric-side constraints exist. Drives from benchmarks using
	//   idx_benchmarks_pipelinegroup_hidden so Couchbase does an index seek rather than scanning
	//   all metrics and expanding their benchmarks before filtering.
	selectClause := "SELECT m.id AS metricId, m.`title` AS title, m.component AS component, m.category AS category, "
	selectClause += "m.subCategory AS subCategory, r.clusterId AS `cluster`, m.tags AS tags, "
	selectClause += "{\"name\": c.name, \"os\": CASE WHEN c.os.distro IS NOT MISSING AND c.os.version IS NOT MISSING THEN c.os.distro || '-' || c.os.version WHEN c.os.distro IS NOT MISSING THEN c.os.distro ELSE TO_STRING(c.os) END, \"cpu\": c.cpu, \"disk\": c.disk, \"memory\": c.memory} AS clusterInfo, "
	selectClause += "b.`build` AS `build`, b.`value` AS `value`, r.`buildURL` AS `buildUrl`, b.`snapshots` AS snapshots, b.runId AS runId "

	var fromClause string
	if hasBenchmarkDrivenFilters(filters) {
		// Benchmark-side-only filters: drive from benchmarks so the pipelineGroup index is the seek point.
		fromClause = "FROM " + benchmarksKeyspace + " b " +
			"JOIN " + metricsKeyspace + " m ON KEYS b.metric " +
			"JOIN " + runsKeyspace + " r ON KEYS b.runId " +
			"JOIN " + clustersKeyspace + " c ON KEYS r.clusterId "
	} else {
		// Metric-side filters present: drive from metrics for index efficiency.
		fromClause = "FROM " + metricsKeyspace + " m " +
			"JOIN " + benchmarksKeyspace + " b ON KEY b.metric FOR m " +
			"JOIN " + runsKeyspace + " r ON KEYS b.runId " +
			"JOIN " + clustersKeyspace + " c ON KEYS r.clusterId "
	}

	query := selectClause + fromClause
	whereClauses := []string{"r.status = 'completed'"}
	if !filters.ShowHiddenMetrics {
		whereClauses = append(whereClauses, "m.hidden = False")
	}
	if !filters.ShowHiddenBenchmarks {
		whereClauses = append(whereClauses, "b.hidden = False")
	}
	if filters.TitleSearch != "" {
		whereClauses = append(whereClauses, "CONTAINS(LOWER(m.`title`), $titleSearch)")
	}
	query += "WHERE " + strings.Join(whereClauses, " AND ")
	params := make(map[string]interface{})
	if filters.TitleSearch != "" {
		params["titleSearch"] = strings.ToLower(filters.TitleSearch)
	}
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
			RunID:     row.RunID,
		})
	}

	totalPoints := 0
	panels := make([]models.TimelinePanel, 0, len(panelOrder))
	panelBuildParseCache := make(map[string]semanticBuildParse)
	for _, metricID := range panelOrder {
		pts := panelMap[metricID].BenchmarksValues
		sort.SliceStable(pts, func(i, j int) bool {
			return compareSemanticBuildCached(pts[i].Build, pts[j].Build, panelBuildParseCache) < 0
		})
		totalPoints += len(pts)
		panels = append(panels, *panelMap[metricID])
	}
	aggMs := time.Since(aggStart).Milliseconds()

	if isPureViewQuery(filters) {
		ds.panels.set(panelCacheKey(filters.Components[0], filters.Categories[0]), panels)
	}

	log.DefaultLogger.Info("GetTimelinePanels",
		"rows", len(results),
		"panels", len(panels),
		"totalPoints", totalPoints,
		"queryMs", queryMs,
		"aggMs", aggMs,
	)

	return &panels, nil
}

// GetTimelinePanelsWithPagination retrieves timeline panels with pagination applied at the datastore level.
// This prevents pagination logic from being duplicated in the handler and prepares for future optimizations
// where pagination can be pushed further into the query/aggregation layer.
func (ds *DataStore) GetTimelinePanelsWithPagination(filters *FilterOptions, limit, offset int, c context.Context) (*models.PaginatedTimelinesResponse, error) {
	all, err := ds.GetTimelinePanels(filters, c)
	if err != nil || all == nil {
		return nil, err
	}

	panels := *all
	total := len(panels)

	// Validate and normalize pagination parameters
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	// Calculate slice bounds
	start := offset
	if start > total {
		start = total
	}
	end := start + limit
	if end > total {
		end = total
	}

	return &models.PaginatedTimelinesResponse{
		Panels: panels[start:end],
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}, nil
}

func (ds *DataStore) GetAllRuns(metricID string, build string, c context.Context) ([]models.Run, error) {
	query := "SELECT DISTINCT RAW r FROM " + benchmarksKeyspace + " b JOIN " + runsKeyspace + " r ON KEYS b.runId WHERE b.metric = $metricID AND b.`build` = $build AND r.status = 'completed' ORDER BY r.dateTime DESC"
	params := map[string]interface{}{
		"metricID": metricID,
		"build":    build,
	}
	return queryRows[models.Run](ds.cluster, query, params, "run", c)
}

func (ds *DataStore) GetRunDetail(runID, metricID string, c context.Context) (*models.RunDetail, error) {
	type runDetailRow struct {
		BenchmarkValue         float64                `json:"benchmarkValue"`
		BenchmarkBuild         string                 `json:"benchmarkBuild"`
		BenchmarkOS            string                 `json:"benchmarkOS"`
		BenchmarkDateTime      string                 `json:"benchmarkDateTime"`
		BenchmarkPipelineGroup string                 `json:"benchmarkPipelineGroup"`
		BenchmarkHidden        bool                   `json:"benchmarkHidden"`
		BenchmarkSnapshots     []string               `json:"benchmarkSnapshots"`
		MetricTitle            string                 `json:"metricTitle"`
		MetricComponent        string                 `json:"metricComponent"`
		MetricCategory         string                 `json:"metricCategory"`
		MetricSubCategory      string                 `json:"metricSubCategory"`
		MetricChirality        *int                   `json:"metricChirality"`
		MetricMemQuota         int64                  `json:"metricMemQuota"`
		MetricProvider         string                 `json:"metricProvider"`
		RunBuildURL            string                 `json:"runBuildURL"`
		RunDateTime            string                 `json:"runDateTime"`
		RunAttempt             int                    `json:"runAttempt"`
		RunVersions            map[string]interface{} `json:"runVersions"`
		TestTitle              string                 `json:"testTitle"`
		TestConfig             string                 `json:"testConfig"`
		TestThreshold          *float64               `json:"testThreshold"`
		TestTags               map[string]interface{} `json:"testTags"`
		ClusterName            string                 `json:"clusterName"`
		ClusterOS              string                 `json:"clusterOS"`
		ClusterCPU             string                 `json:"clusterCPU"`
		ClusterMemory          string                 `json:"clusterMemory"`
		ClusterDisk            string                 `json:"clusterDisk"`
		ClusterProvider        string                 `json:"clusterProvider"`
		BuildVersion           string                 `json:"buildVersion"`
		BuildMajorMinor        string                 `json:"buildMajorMinor"`
		BuildType              string                 `json:"buildType"`
	}

	query := `SELECT
		b.` + "`value`" + ` AS benchmarkValue,
		b.` + "`build`" + ` AS benchmarkBuild,
		b.os AS benchmarkOS,
		b.dateTime AS benchmarkDateTime,
		b.pipelineGroup AS benchmarkPipelineGroup,
		b.hidden AS benchmarkHidden,
		b.snapshots AS benchmarkSnapshots,
		m.` + "`title`" + ` AS metricTitle,
		m.component AS metricComponent,
		m.category AS metricCategory,
		m.subCategory AS metricSubCategory,
		m.chirality AS metricChirality,
		m.memquota AS metricMemQuota,
		m.provider AS metricProvider,
		r.` + "`buildURL`" + ` AS runBuildURL,
		r.dateTime AS runDateTime,
		r.attempt AS runAttempt,
		r.versions AS runVersions,
		t.` + "`title`" + ` AS testTitle,
		t.testConfig AS testConfig,
		t.threshold AS testThreshold,
		t.tags AS testTags,
		c.` + "`name`" + ` AS clusterName,
		CASE WHEN c.os.distro IS NOT MISSING AND c.os.version IS NOT MISSING
			THEN c.os.distro || ' ' || c.os.version
			WHEN c.os.distro IS NOT MISSING THEN c.os.distro
			ELSE TO_STRING(c.os) END AS clusterOS,
		c.cpu AS clusterCPU,
		c.memory AS clusterMemory,
		c.disk AS clusterDisk,
		c.provider AS clusterProvider,
		bld.version AS buildVersion,
		bld.majorMinor AS buildMajorMinor,
		bld.buildType AS buildType
	FROM ` + benchmarksKeyspace + ` b
	JOIN ` + runsKeyspace + ` r ON KEYS b.runId
	JOIN ` + metricsKeyspace + ` m ON KEYS b.metric
	JOIN ` + testsKeyspace + ` t ON KEYS r.testId
	JOIN ` + clustersKeyspace + ` c ON KEYS r.clusterId
	JOIN ` + buildsKeyspace + ` bld ON KEYS r.serverBuildId
	WHERE b.runId = $runID AND b.metric = $metricID
	LIMIT 1`

	params := map[string]interface{}{
		"runID":    runID,
		"metricID": metricID,
	}

	rows, err := queryRows[runDetailRow](ds.cluster, query, params, "run detail", c)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}

	row := rows[0]

	versions := models.RunVersions{}
	if row.RunVersions != nil {
		if v, ok := row.RunVersions["sdk"].(string); ok {
			versions.SDK = &v
		}
		if v, ok := row.RunVersions["tls"].(string); ok {
			versions.TLS = &v
		}
		if v, ok := row.RunVersions["capella"].(string); ok {
			versions.Capella = &v
		}
		if v, ok := row.RunVersions["aiGateway"].(string); ok {
			versions.AIGateway = &v
		}
	}

	detail := &models.RunDetail{
		Benchmark: models.RunDetailBenchmark{
			RunID:         runID,
			Value:         row.BenchmarkValue,
			Build:         row.BenchmarkBuild,
			OS:            row.BenchmarkOS,
			DateTime:      row.BenchmarkDateTime,
			PipelineGroup: row.BenchmarkPipelineGroup,
			Hidden:        row.BenchmarkHidden,
			Snapshots:     row.BenchmarkSnapshots,
		},
		Metric: models.RunDetailMetric{
			Title:       row.MetricTitle,
			Component:   row.MetricComponent,
			Category:    row.MetricCategory,
			SubCategory: row.MetricSubCategory,
			Chirality:   row.MetricChirality,
			MemQuota:    row.MetricMemQuota,
			Provider:    row.MetricProvider,
		},
		Run: models.RunDetailRun{
			BuildURL: row.RunBuildURL,
			DateTime: row.RunDateTime,
			Attempt:  row.RunAttempt,
			Versions: versions,
		},
		Test: models.RunDetailTest{
			Title:      row.TestTitle,
			TestConfig: row.TestConfig,
			Threshold:  row.TestThreshold,
			Tags:       row.TestTags,
		},
		Cluster: models.RunDetailCluster{
			Name:     row.ClusterName,
			OS:       row.ClusterOS,
			CPU:      row.ClusterCPU,
			Memory:   row.ClusterMemory,
			Disk:     row.ClusterDisk,
			Provider: row.ClusterProvider,
		},
		Build: models.RunDetailBuild{
			Version:    row.BuildVersion,
			MajorMinor: row.BuildMajorMinor,
			BuildType:  row.BuildType,
		},
	}

	// Fetch all benchmark executions for the same metric + build so the drawer
	// can display reruns grouped together.
	type rerunRow struct {
		RunID       string                 `json:"runId"`
		Value       float64                `json:"value"`
		DateTime    string                 `json:"dateTime"`
		Snapshots   []string               `json:"snapshots"`
		Hidden      bool                   `json:"hidden"`
		BuildURL    string                 `json:"buildUrl"`
		Attempt     int                    `json:"attempt"`
		RunVersions map[string]interface{} `json:"runVersions"`
	}

	// No b.hidden filter — hidden benchmarks are always shown in the drawer.
	rerunQuery := `SELECT
		b.runId AS runId,
		b.` + "`value`" + ` AS value,
		b.dateTime AS dateTime,
		b.snapshots AS snapshots,
		b.hidden AS hidden,
		r.` + "`buildURL`" + ` AS buildUrl,
		r.attempt AS attempt,
		r.versions AS runVersions
	FROM ` + benchmarksKeyspace + ` b
	JOIN ` + runsKeyspace + ` r ON KEYS b.runId
	WHERE b.metric = $metricID AND b.` + "`build`" + ` = $build AND r.status = 'completed'
	ORDER BY b.dateTime ASC`

	rerunParams := map[string]interface{}{
		"metricID": metricID,
		"build":    row.BenchmarkBuild,
	}

	rerunRows, err := queryRows[rerunRow](ds.cluster, rerunQuery, rerunParams, "rerun", c)
	if err == nil {
		reruns := make([]models.RunSummary, 0, len(rerunRows))
		for _, rr := range rerunRows {
			rv := models.RunVersions{}
			if rr.RunVersions != nil {
				if v, ok := rr.RunVersions["sdk"].(string); ok {
					rv.SDK = &v
				}
				if v, ok := rr.RunVersions["tls"].(string); ok {
					rv.TLS = &v
				}
				if v, ok := rr.RunVersions["capella"].(string); ok {
					rv.Capella = &v
				}
				if v, ok := rr.RunVersions["aiGateway"].(string); ok {
					rv.AIGateway = &v
				}
			}
			reruns = append(reruns, models.RunSummary{
				RunID:     rr.RunID,
				Value:     rr.Value,
				DateTime:  rr.DateTime,
				Attempt:   rr.Attempt,
				BuildURL:  rr.BuildURL,
				Snapshots: rr.Snapshots,
				Versions:  rv,
				Hidden:    rr.Hidden,
			})
		}
		detail.Reruns = reruns
	}

	return detail, nil
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
