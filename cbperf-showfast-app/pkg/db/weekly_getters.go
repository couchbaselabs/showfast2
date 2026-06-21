package db

import (
	"context"
	"sort"
	"strings"

	"github.com/cbperf/showfast/pkg/models"
	"github.com/couchbase/gocb/v2"
)

func (ds *DataStore) GetWeeklyBuilds(ctx context.Context) (*models.WeeklyBuildsResponse, error) {
	type buildRow struct {
		Build  string `json:"build"`
		Date   string `json:"date"`
		Active bool   `json:"active"`
	}

	query := `
		SELECT p.` + "`build`" + `, p.` + "`date`" + `, p.active
		FROM ` + pipelinesKeyspace + ` p
		WHERE p.` + "`type`" + ` = "weekly"
		ORDER BY p.` + "`date`" + ` DESC
	`

	rows, err := queryRows[buildRow](ds.cluster, query, nil, "weekly-builds query", ctx)
	if err != nil {
		return nil, err
	}

	builds := make([]models.WeeklyBuildEntry, 0, len(rows))
	for _, r := range rows {
		builds = append(builds, models.WeeklyBuildEntry{
			Build:  r.Build,
			Date:   r.Date,
			Active: r.Active,
		})
	}

	return &models.WeeklyBuildsResponse{Builds: builds}, nil
}

func (ds *DataStore) GetWeeklyDetail(ctx context.Context, build string) (*models.WeeklyDetailResponse, error) {
	// Fast path: read precomputed docs written by GenerateWeeklyDocs.
	var resp *models.WeeklyDetailResponse
	if r := ds.weeklyDetailFromDocs(ctx, build); r != nil {
		resp = r
	} else {
		// Slow path: live computation (used when generate has not been run yet).
		var err error
		resp, err = ds.weeklyDetailLive(ctx, build)
		if err != nil {
			return nil, err
		}
	}

	if resp != nil {
		resp.Tickets = weeklyTickets(ds, ctx, build)
	}
	return resp, nil
}

// weeklyTickets reads the tickets field from the pipeline doc for the given build.
func weeklyTickets(ds *DataStore, ctx context.Context, build string) map[string][]string {
	type ticketRow struct {
		Tickets map[string][]string `json:"tickets"`
	}
	query := `
		SELECT p.tickets
		FROM ` + pipelinesKeyspace + ` p
		WHERE p.` + "`build`" + ` = $build AND p.` + "`type`" + ` = "weekly"
		LIMIT 1
	`
	rows, err := queryRows[ticketRow](ds.cluster, query, map[string]interface{}{"build": build}, "weekly-tickets query", ctx)
	if err != nil || len(rows) == 0 || rows[0].Tickets == nil {
		return nil
	}
	return rows[0].Tickets
}

// weeklyDetailFromDocs reads the precomputed summary + per-component detail docs.
// Component docs are fetched concurrently. Returns nil if any doc is absent or
// unreadable (caller falls back to live computation).
func (ds *DataStore) weeklyDetailFromDocs(ctx context.Context, build string) *models.WeeklyDetailResponse {
	weeklyCol := ds.cluster.Bucket("showfast").Scope("management").Collection("weekly")

	var summaryDoc models.WeeklyDoc
	res, err := weeklyCol.Get("weekly::"+build, &gocb.GetOptions{Context: ctx})
	if err != nil || res.Content(&summaryDoc) != nil || len(summaryDoc.Components) == 0 {
		return nil
	}

	type fetchResult struct {
		idx    int
		detail models.WeeklyComponentDetail
		err    error
	}

	n := len(summaryDoc.Components)
	ch := make(chan fetchResult, n)
	for i, cs := range summaryDoc.Components {
		go func(i int, component string) {
			key := "weekly-detail::" + build + "::" + component
			r, err := weeklyCol.Get(key, &gocb.GetOptions{Context: ctx})
			if err != nil {
				ch <- fetchResult{idx: i, err: err}
				return
			}
			var doc models.WeeklyComponentDetailDoc
			if err := r.Content(&doc); err != nil {
				ch <- fetchResult{idx: i, err: err}
				return
			}
			ch <- fetchResult{idx: i, detail: models.WeeklyComponentDetail{
				Component: doc.Component,
				Metrics:   doc.Metrics,
			}}
		}(i, cs.Component)
	}

	components := make([]models.WeeklyComponentDetail, n)
	for range summaryDoc.Components {
		r := <-ch
		if r.err != nil {
			return nil // missing or unreadable doc — fall back to live
		}
		components[r.idx] = r.detail
	}

	return &models.WeeklyDetailResponse{
		Build:      build,
		Date:       summaryDoc.Date,
		Components: components,
	}
}

// weeklyDetailLive computes the weekly detail on the fly via N1QL.
// This is the original implementation, preserved as a fallback.
func (ds *DataStore) weeklyDetailLive(ctx context.Context, build string) (*models.WeeklyDetailResponse, error) {
	type runRow struct {
		MetricID    string   `json:"metricId"`
		Value       float64  `json:"value"`
		DateTime    string   `json:"dateTime"`
		Chirality   int      `json:"chirality"`
		Threshold   *float64 `json:"threshold"`
		Component   string   `json:"component"`
		Title       string   `json:"title"`
		Category    string   `json:"category"`
		SubCategory string   `json:"subCategory"`
		BuildURL    string   `json:"buildUrl"`
	}

	query := `
		SELECT b.metric AS metricId, b.` + "`value`" + ` AS ` + "`value`" + `,
		       r.dateTime AS dateTime,
		       m.chirality AS chirality, t.threshold AS threshold,
		       m.component AS component, m.` + "`title`" + ` AS ` + "`title`" + `,
		       m.category AS category, m.subCategory AS subCategory,
		       r.buildURL AS buildUrl
		FROM ` + benchmarksKeyspace + ` b
		JOIN ` + runsKeyspace + ` r ON KEYS b.runId
		JOIN ` + metricsKeyspace + ` m ON KEYS b.metric
		LEFT JOIN ` + testsKeyspace + ` t ON KEYS r.testId
		WHERE m.hidden = false
		  AND b.hidden = false
		  AND r.status = 'completed'
		  AND b.` + "`build`" + ` = $build
		ORDER BY r.dateTime DESC
	`

	params := map[string]interface{}{"build": build}
	runs, err := queryRows[runRow](ds.cluster, query, params, "weekly-detail runs query", ctx)
	if err != nil {
		return nil, err
	}

	// Deduplicate: keep the most recent run per metricId (query is DESC so first wins).
	seen := make(map[string]struct{}, len(runs))
	deduped := make([]runRow, 0, len(runs))
	for _, r := range runs {
		if _, ok := seen[r.MetricID]; ok {
			continue
		}
		seen[r.MetricID] = struct{}{}
		deduped = append(deduped, r)
	}

	if len(deduped) == 0 {
		date := weeklyBuildDate(ds, ctx, build)
		return &models.WeeklyDetailResponse{
			Build:      build,
			Date:       date,
			Components: []models.WeeklyComponentDetail{},
		}, nil
	}

	metricIds := make([]string, 0, len(deduped))
	for _, r := range deduped {
		metricIds = append(metricIds, `"`+r.MetricID+`"`)
	}

	type baselineRow struct {
		MetricID string  `json:"metricId"`
		Baseline float64 `json:"baseline"`
	}

	baselineQuery := `
		SELECT b.metric AS metricId, MEDIAN(TONUMBER(b.` + "`value`" + `)) AS baseline
		FROM ` + benchmarksKeyspace + ` b
		JOIN ` + runsKeyspace + ` r ON KEYS b.runId
		WHERE b.metric IN [` + strings.Join(metricIds, ",") + `]
		  AND b.` + "`build`" + ` != $build
		  AND r.status = 'completed'
		  AND STR_TO_MILLIS(r.dateTime) > DATE_ADD_MILLIS(NOW_MILLIS(), -30, 'day')
		GROUP BY b.metric
	`

	baselines, err := queryRows[baselineRow](ds.cluster, baselineQuery, params, "weekly-detail baselines query", ctx)
	if err != nil {
		return nil, err
	}

	baselineMap := make(map[string]float64, len(baselines))
	for _, b := range baselines {
		baselineMap[b.MetricID] = b.Baseline
	}

	compMap := make(map[string][]models.WeeklyMetricResult)
	for _, r := range deduped {
		baseline := baselineMap[r.MetricID]
		status := computeRunStatus(r.Value, baseline, r.Chirality, r.Threshold)
		compMap[r.Component] = append(compMap[r.Component], models.WeeklyMetricResult{
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
	components := make([]models.WeeklyComponentDetail, 0, len(compMap))
	for comp, metrics := range compMap {
		sort.Slice(metrics, func(i, j int) bool {
			ri, rj := statusRank[metrics[i].Status], statusRank[metrics[j].Status]
			if ri != rj {
				return ri < rj
			}
			return metrics[i].Title < metrics[j].Title
		})
		components = append(components, models.WeeklyComponentDetail{
			Component: comp,
			Metrics:   metrics,
		})
	}
	sort.Slice(components, func(i, j int) bool {
		return components[i].Component < components[j].Component
	})

	date := weeklyBuildDate(ds, ctx, build)
	return &models.WeeklyDetailResponse{
		Build:      build,
		Date:       date,
		Components: components,
	}, nil
}

// weeklyBuildDate looks up the date for a build from management.pipelines.
func weeklyBuildDate(ds *DataStore, ctx context.Context, build string) string {
	type dateRow struct {
		Date string `json:"date"`
	}
	query := `
		SELECT p.` + "`date`" + `
		FROM ` + pipelinesKeyspace + ` p
		WHERE p.` + "`build`" + ` = $build AND p.` + "`type`" + ` = "weekly"
		LIMIT 1
	`
	rows, err := queryRows[dateRow](ds.cluster, query, map[string]interface{}{"build": build}, "weekly-build-date query", ctx)
	if err != nil || len(rows) == 0 {
		return ""
	}
	return rows[0].Date
}
