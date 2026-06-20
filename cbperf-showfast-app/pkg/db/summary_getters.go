package db

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/cbperf/showfast/pkg/models"
	"github.com/couchbase/gocb/v2"
)

// computeRunStatus mirrors the threshold logic in timelinesPanelBuilder.ts.
func computeRunStatus(value, baseline float64, chirality int, threshold *float64) string {
	if chirality == 0 || baseline == 0 {
		return "neutral"
	}
	yellowPct := 0.05
	redPct := 0.10
	if threshold != nil {
		yellowPct = *threshold / 100
		redPct = (*threshold * 2) / 100
	}
	if chirality > 0 {
		if value >= baseline*(1-yellowPct) {
			return "passed"
		}
		if value >= baseline*(1-redPct) {
			return "warning"
		}
		return "regressed"
	}
	if value <= baseline*(1+yellowPct) {
		return "passed"
	}
	if value <= baseline*(1+redPct) {
		return "warning"
	}
	return "regressed"
}

// getActivePipelines returns pipeline docs from showfast.management.pipelines
// filtered by active=true and the given type ("daily" or "weekly").
func (ds *DataStore) getActivePipelines(ctx context.Context, pipelineType string) ([]models.PipelineDoc, error) {
	query := fmt.Sprintf(`
		SELECT p.`+"`build`"+`, p.`+"`type`"+`, p.`+"`date`"+`, p.active
		FROM %s p
		WHERE p.active = true AND p.`+"`type`"+` = "%s"
		ORDER BY p.`+"`date`"+` DESC
	`, pipelinesKeyspace, pipelineType)

	return queryRows[models.PipelineDoc](ds.cluster, query, nil, "active-pipelines query", ctx)
}

// componentStatusForBuilds returns per-component pass/warn/regressed counts
// for the given set of builds. Baselines are derived from the last 30 days
// of historical runs, excluding the pipeline builds themselves.
func (ds *DataStore) componentStatusForBuilds(ctx context.Context, builds []string) (map[string][]models.ComponentStatus, error) {
	if len(builds) == 0 {
		return map[string][]models.ComponentStatus{}, nil
	}

	quoted := make([]string, len(builds))
	for i, b := range builds {
		quoted[i] = `"` + b + `"`
	}
	buildList := strings.Join(quoted, ",")

	type runRow struct {
		MetricID  string   `json:"metricId"`
		Value     float64  `json:"value"`
		Build     string   `json:"build"`
		Chirality int      `json:"chirality"`
		Threshold *float64 `json:"threshold"`
		Component string   `json:"component"`
	}

	query1 := fmt.Sprintf(`
		SELECT b.metric AS metricId, b.`+"`value`"+` AS `+"`value`"+`, b.`+"`build`"+` AS `+"`build`"+`,
		       m.chirality AS chirality, t.threshold AS threshold, m.component AS component
		FROM %s b
		JOIN %s r ON KEYS b.runId
		JOIN %s m ON KEYS b.metric
		LEFT JOIN %s t ON KEYS r.testId
		WHERE m.hidden = false
		  AND b.hidden = false
		  AND r.status = 'completed'
		  AND b.`+"`build`"+` IN [%s]
	`, benchmarksKeyspace, runsKeyspace, metricsKeyspace, testsKeyspace, buildList)

	runs, err := queryRows[runRow](ds.cluster, query1, nil, "pipeline-runs query", ctx)
	if err != nil {
		return nil, err
	}

	if len(runs) == 0 {
		return map[string][]models.ComponentStatus{}, nil
	}

	// Collect unique metricIds.
	metricSet := make(map[string]struct{}, len(runs))
	for _, r := range runs {
		metricSet[r.MetricID] = struct{}{}
	}
	metricIds := make([]string, 0, len(metricSet))
	for id := range metricSet {
		metricIds = append(metricIds, `"`+id+`"`)
	}

	type baselineRow struct {
		MetricID string  `json:"metricId"`
		Baseline float64 `json:"baseline"`
	}

	// Baseline = median of last 30 days excluding the current pipeline builds.
	query2 := fmt.Sprintf(`
		SELECT b.metric AS metricId, MEDIAN(TONUMBER(b.`+"`value`"+`)) AS baseline
		FROM %s b
		JOIN %s r ON KEYS b.runId
		WHERE b.metric IN [%s]
		  AND b.`+"`build`"+` NOT IN [%s]
		  AND r.status = 'completed'
		  AND STR_TO_MILLIS(r.dateTime) > DATE_ADD_MILLIS(NOW_MILLIS(), -30, 'day')
		GROUP BY b.metric
	`, benchmarksKeyspace, runsKeyspace, strings.Join(metricIds, ","), buildList)

	baselines, err := queryRows[baselineRow](ds.cluster, query2, nil, "pipeline-baselines query", ctx)
	if err != nil {
		return nil, err
	}

	baselineMap := make(map[string]float64, len(baselines))
	for _, b := range baselines {
		baselineMap[b.MetricID] = b.Baseline
	}

	// Group by (build, component).
	type buildComponentKey struct{ build, component string }
	statusMap := make(map[buildComponentKey]*models.ComponentStatus)

	for _, r := range runs {
		key := buildComponentKey{r.Build, r.Component}
		cs, ok := statusMap[key]
		if !ok {
			cs = &models.ComponentStatus{Component: r.Component}
			statusMap[key] = cs
		}
		cs.Total++
		switch computeRunStatus(r.Value, baselineMap[r.MetricID], r.Chirality, r.Threshold) {
		case "passed":
			cs.Passed++
		case "warning":
			cs.Warning++
		case "regressed":
			cs.Regressed++
		default:
			cs.Neutral++
		}
	}

	// Collect into map[build][]ComponentStatus (sorted by component name).
	result := make(map[string][]models.ComponentStatus)
	for key, cs := range statusMap {
		result[key.build] = append(result[key.build], *cs)
	}
	for build := range result {
		sort.Slice(result[build], func(i, j int) bool {
			return result[build][i].Component < result[build][j].Component
		})
	}

	return result, nil
}

func (ds *DataStore) getPipelineSummary(ctx context.Context, pipelineType string) (*models.PipelineSummaryResponse, error) {
	pipelines, err := ds.getActivePipelines(ctx, pipelineType)
	if err != nil {
		return nil, err
	}

	if len(pipelines) == 0 {
		return &models.PipelineSummaryResponse{Pipelines: []models.PipelineSummary{}}, nil
	}

	builds := make([]string, len(pipelines))
	for i, p := range pipelines {
		builds[i] = p.Build
	}

	componentsByBuild, err := ds.componentStatusForBuilds(ctx, builds)
	if err != nil {
		return nil, err
	}

	summaries := make([]models.PipelineSummary, 0, len(pipelines))
	for _, p := range pipelines {
		components := componentsByBuild[p.Build]
		if components == nil {
			components = []models.ComponentStatus{}
		}
		summaries = append(summaries, models.PipelineSummary{
			Build:      p.Build,
			Type:       p.Type,
			Date:       p.Date,
			Components: components,
		})
	}

	return &models.PipelineSummaryResponse{Pipelines: summaries}, nil
}

func (ds *DataStore) GetDailyPipelineSummary(ctx context.Context) (*models.PipelineSummaryResponse, error) {
	return ds.getPipelineSummary(ctx, "daily")
}

// GetWeeklyPipelineSummary reads pre-computed weekly docs from management.weekly,
// filtered to builds that have an active weekly pipeline in management.pipelines.
func (ds *DataStore) GetWeeklyPipelineSummary(ctx context.Context) (*models.PipelineSummaryResponse, error) {
	type weeklyRow struct {
		Build      string                 `json:"build"`
		Date       string                 `json:"date"`
		Components []models.ComponentStatus `json:"components"`
	}

	query := `
		SELECT w.` + "`build`" + `, w.` + "`date`" + `, w.components
		FROM ` + weeklyManagementKeyspace + ` w
		WHERE META(w).id LIKE "weekly::%"
		  AND META(w).id NOT LIKE "weekly-detail::%"
		  AND w.` + "`build`" + ` IN (
			SELECT RAW p.` + "`build`" + `
			FROM ` + pipelinesKeyspace + ` p
			WHERE p.active = true AND p.` + "`type`" + ` = "weekly"
		)
		ORDER BY w.` + "`date`" + ` DESC
	`

	rows, err := queryRows[weeklyRow](ds.cluster, query, nil, "weekly-docs query", ctx)
	if err != nil {
		return nil, err
	}

	pipelines := make([]models.PipelineSummary, 0, len(rows))
	for _, r := range rows {
		components := r.Components
		if components == nil {
			components = []models.ComponentStatus{}
		}
		pipelines = append(pipelines, models.PipelineSummary{
			Build:      r.Build,
			Type:       "weekly",
			Date:       r.Date,
			Components: components,
		})
	}

	return &models.PipelineSummaryResponse{Pipelines: pipelines}, nil
}

// generateWeeklyDetailForBuilds runs the full join query for the given builds and
// returns both per-component metric details and aggregate counts in a single pass.
// It is the authoritative computation that GenerateWeeklyDocs persists to Couchbase.
func (ds *DataStore) generateWeeklyDetailForBuilds(
	ctx context.Context,
	builds []string,
) (
	detailByBuild map[string][]models.WeeklyComponentDetail,
	statusByBuild map[string][]models.ComponentStatus,
	err error,
) {
	if len(builds) == 0 {
		return map[string][]models.WeeklyComponentDetail{},
			map[string][]models.ComponentStatus{}, nil
	}

	quoted := make([]string, len(builds))
	for i, b := range builds {
		quoted[i] = `"` + b + `"`
	}
	buildList := strings.Join(quoted, ",")

	type detailRunRow struct {
		MetricID    string   `json:"metricId"`
		Value       float64  `json:"value"`
		DateTime    string   `json:"dateTime"`
		Build       string   `json:"build"`
		Chirality   int      `json:"chirality"`
		Threshold   *float64 `json:"threshold"`
		Component   string   `json:"component"`
		Title       string   `json:"title"`
		Category    string   `json:"category"`
		SubCategory string   `json:"subCategory"`
		BuildURL    string   `json:"buildUrl"`
	}

	query1 := fmt.Sprintf(`
		SELECT b.metric AS metricId, b.`+"`value`"+` AS `+"`value`"+`,
		       r.dateTime AS dateTime, b.`+"`build`"+` AS `+"`build`"+`,
		       m.chirality AS chirality, t.threshold AS threshold,
		       m.component AS component, m.`+"`title`"+` AS `+"`title`"+`,
		       m.category AS category, m.subCategory AS subCategory,
		       r.buildURL AS buildUrl
		FROM %s b
		JOIN %s r ON KEYS b.runId
		JOIN %s m ON KEYS b.metric
		LEFT JOIN %s t ON KEYS r.testId
		WHERE m.hidden = false
		  AND b.hidden = false
		  AND r.status = 'completed'
		  AND b.`+"`build`"+` IN [%s]
		ORDER BY r.dateTime DESC
	`, benchmarksKeyspace, runsKeyspace, metricsKeyspace, testsKeyspace, buildList)

	runs, err := queryRows[detailRunRow](ds.cluster, query1, nil, "weekly-detail-gen runs", ctx)
	if err != nil {
		return nil, nil, err
	}
	if len(runs) == 0 {
		return map[string][]models.WeeklyComponentDetail{},
			map[string][]models.ComponentStatus{}, nil
	}

	// Deduplicate per (build, metricId): query is DESC so first occurrence is most recent.
	type buildMetricKey struct{ build, metricId string }
	seen := make(map[buildMetricKey]struct{}, len(runs))
	deduped := make([]detailRunRow, 0, len(runs))
	for _, r := range runs {
		k := buildMetricKey{r.Build, r.MetricID}
		if _, ok := seen[k]; ok {
			continue
		}
		seen[k] = struct{}{}
		deduped = append(deduped, r)
	}

	metricSet := make(map[string]struct{}, len(deduped))
	for _, r := range deduped {
		metricSet[r.MetricID] = struct{}{}
	}
	metricIds := make([]string, 0, len(metricSet))
	for id := range metricSet {
		metricIds = append(metricIds, `"`+id+`"`)
	}

	type baselineRow struct {
		MetricID string  `json:"metricId"`
		Baseline float64 `json:"baseline"`
	}
	query2 := fmt.Sprintf(`
		SELECT b.metric AS metricId, MEDIAN(TONUMBER(b.`+"`value`"+`)) AS baseline
		FROM %s b
		JOIN %s r ON KEYS b.runId
		WHERE b.metric IN [%s]
		  AND b.`+"`build`"+` NOT IN [%s]
		  AND r.status = 'completed'
		  AND STR_TO_MILLIS(r.dateTime) > DATE_ADD_MILLIS(NOW_MILLIS(), -30, 'day')
		GROUP BY b.metric
	`, benchmarksKeyspace, runsKeyspace, strings.Join(metricIds, ","), buildList)

	baselines, err := queryRows[baselineRow](ds.cluster, query2, nil, "weekly-detail-gen baselines", ctx)
	if err != nil {
		return nil, nil, err
	}
	baselineMap := make(map[string]float64, len(baselines))
	for _, b := range baselines {
		baselineMap[b.MetricID] = b.Baseline
	}

	// Group metrics by (build, component).
	type buildCompKey struct{ build, component string }
	metricsMap := make(map[buildCompKey][]models.WeeklyMetricResult)
	for _, r := range deduped {
		baseline := baselineMap[r.MetricID]
		status := computeRunStatus(r.Value, baseline, r.Chirality, r.Threshold)
		k := buildCompKey{r.Build, r.Component}
		metricsMap[k] = append(metricsMap[k], models.WeeklyMetricResult{
			MetricID:    r.MetricID,
			Title:       r.Title,
			Component:   r.Component,
			Category:    r.Category,
			SubCategory: r.SubCategory,
			Value:       r.Value,
			Baseline:    baseline,
			Status:      status,
			BuildURL:    r.BuildURL,
			Chirality:   r.Chirality,
			Threshold:   r.Threshold,
		})
	}

	statusRank := map[string]int{"regressed": 0, "warning": 1, "passed": 2, "neutral": 3}
	detailByBuild = make(map[string][]models.WeeklyComponentDetail)
	statusByBuild = make(map[string][]models.ComponentStatus)

	for k, metrics := range metricsMap {
		sort.Slice(metrics, func(i, j int) bool {
			ri, rj := statusRank[metrics[i].Status], statusRank[metrics[j].Status]
			if ri != rj {
				return ri < rj
			}
			return metrics[i].Title < metrics[j].Title
		})
		detailByBuild[k.build] = append(detailByBuild[k.build], models.WeeklyComponentDetail{
			Component: k.component,
			Metrics:   metrics,
		})
		cs := models.ComponentStatus{Component: k.component, Total: len(metrics)}
		for _, m := range metrics {
			switch m.Status {
			case "passed":
				cs.Passed++
			case "warning":
				cs.Warning++
			case "regressed":
				cs.Regressed++
			default:
				cs.Neutral++
			}
		}
		statusByBuild[k.build] = append(statusByBuild[k.build], cs)
	}

	for build := range detailByBuild {
		sort.Slice(detailByBuild[build], func(i, j int) bool {
			return detailByBuild[build][i].Component < detailByBuild[build][j].Component
		})
	}
	for build := range statusByBuild {
		sort.Slice(statusByBuild[build], func(i, j int) bool {
			return statusByBuild[build][i].Component < statusByBuild[build][j].Component
		})
	}

	return detailByBuild, statusByBuild, nil
}

// GenerateWeeklyDocs computes per-component threshold status for every active weekly
// pipeline build and upserts the results into management.weekly. Writes:
//   - "weekly::<build>"                    — summary counts per component
//   - "weekly-detail::<build>::<component>" — full metric list per component
//
// Returns the generated summaries so the caller can confirm what was written.
func (ds *DataStore) GenerateWeeklyDocs(ctx context.Context) (*models.PipelineSummaryResponse, error) {
	pipelines, err := ds.getActivePipelines(ctx, "weekly")
	if err != nil {
		return nil, err
	}

	if len(pipelines) == 0 {
		return &models.PipelineSummaryResponse{Pipelines: []models.PipelineSummary{}}, nil
	}

	builds := make([]string, len(pipelines))
	for i, p := range pipelines {
		builds[i] = p.Build
	}

	detailByBuild, statusByBuild, err := ds.generateWeeklyDetailForBuilds(ctx, builds)
	if err != nil {
		return nil, err
	}

	weeklyCol := ds.cluster.Bucket("showfast").Scope("management").Collection("weekly")
	generatedAt := time.Now().UTC().Format(time.RFC3339)

	// Build a date lookup so component detail docs carry the build date.
	dateByBuild := make(map[string]string, len(pipelines))
	for _, p := range pipelines {
		dateByBuild[p.Build] = p.Date
	}

	summaries := make([]models.PipelineSummary, 0, len(pipelines))
	for _, p := range pipelines {
		components := statusByBuild[p.Build]
		if components == nil {
			components = []models.ComponentStatus{}
		}

		// Write summary doc.
		summaryDoc := models.WeeklyDoc{
			Build:       p.Build,
			Date:        p.Date,
			GeneratedAt: generatedAt,
			Components:  components,
		}
		if _, err := weeklyCol.Upsert("weekly::"+p.Build, summaryDoc, &gocb.UpsertOptions{Context: ctx}); err != nil {
			return nil, fmt.Errorf("upsert weekly doc for build %s: %w", p.Build, err)
		}

		// Write one detail doc per component.
		for _, cd := range detailByBuild[p.Build] {
			detailDoc := models.WeeklyComponentDetailDoc{
				Build:       p.Build,
				Date:        p.Date,
				Component:   cd.Component,
				GeneratedAt: generatedAt,
				Metrics:     cd.Metrics,
			}
			detailKey := "weekly-detail::" + p.Build + "::" + cd.Component
			if _, err := weeklyCol.Upsert(detailKey, detailDoc, &gocb.UpsertOptions{Context: ctx}); err != nil {
				return nil, fmt.Errorf("upsert weekly detail doc for build %s component %s: %w", p.Build, cd.Component, err)
			}
		}

		summaries = append(summaries, models.PipelineSummary{
			Build:      p.Build,
			Type:       "weekly",
			Date:       p.Date,
			Components: components,
		})
	}

	return &models.PipelineSummaryResponse{Pipelines: summaries}, nil
}

func (ds *DataStore) GetJenkinsRuns(ctx context.Context, limit int) (*models.JenkinsRunsResponse, error) {
	query := fmt.Sprintf(`
		SELECT j.`+"`test_config`"+`, j.`+"`cluster`"+`, j.`+"`version`"+`, j.`+"`component`"+`,
		       j.`+"`duration`"+`, j.`+"`job`"+`, j.`+"`success`"+`, j.`+"`timestamp`"+`, j.`+"`url`"+`
		FROM `+"`showfast`.`management`.`jenkins`"+` j
		ORDER BY j.`+"`timestamp`"+` DESC
		LIMIT %d
	`, limit)

	runs, err := queryRows[models.JenkinsRun](ds.cluster, query, nil, "jenkins-runs summary", ctx)
	if err != nil {
		return nil, err
	}

	if runs == nil {
		runs = []models.JenkinsRun{}
	}

	return &models.JenkinsRunsResponse{Runs: runs}, nil
}

func (ds *DataStore) GetTestsRanLastMonthCount(c context.Context) (int64, error) {
	type summaryRow struct {
		TestsRanLastMonth int64 `json:"testsRanLastMonth"`
	}

	query := "SELECT COUNT(r.id) AS testsRanLastMonth FROM " + runsKeyspace + " r WHERE r.status = 'completed' AND STR_TO_MILLIS(r.dateTime) > DATE_ADD_MILLIS(NOW_MILLIS(), -28, 'day')"
	rows, err := queryRows[summaryRow](ds.cluster, query, nil, "tests-ran-last-month summary", c)
	if err != nil {
		return 0, err
	}

	if len(rows) == 0 {
		return 0, nil
	}

	return rows[0].TestsRanLastMonth, nil
}

func (ds *DataStore) GetTestsRanForEachComponentLast2Weeks(c context.Context) (*map[string]interface{}, error) {
	type summaryRow struct {
		Component string `json:"component"`
		NumberOf  int64  `json:"number_of"`
	}

	query := `
		SELECT m.component AS component, COUNT(DISTINCT r.id) AS number_of
		FROM ` + benchmarksKeyspace + ` b
		JOIN ` + runsKeyspace + ` r ON KEYS b.runId
		JOIN ` + metricsKeyspace + ` m ON KEYS b.metric
		WHERE m.hidden = false
		  AND b.hidden = false
		  AND r.status = 'completed'
		  AND STR_TO_MILLIS(r.dateTime) > DATE_ADD_MILLIS(NOW_MILLIS(), -28, 'day')
		GROUP BY m.component
		ORDER BY m.component asc
	`
	rows, err := queryRows[summaryRow](ds.cluster, query, nil, "tests-ran-last-2-weeks-by-component summary", c)
	if err != nil {
		return nil, err
	}

	summary := make(map[string]interface{})
	for _, row := range rows {
		summary[row.Component] = row.NumberOf
	}

	return &summary, nil
}
