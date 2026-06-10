package db

import (
	"context"
)

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
