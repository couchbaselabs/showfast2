package db

import (
	"fmt"
	"context"

	"github.com/couchbase/gocb/v2"
)

// queryRows executes a query and reads all rows into a slice, with consistent error handling
func queryRows[T any](cluster *gocb.Cluster, query string, params map[string]interface{}, rowErrorMsg string, c context.Context) ([]T, error) {
	var queryOpts *gocb.QueryOptions
	if params != nil {
		queryOpts = &gocb.QueryOptions{NamedParameters: params, Context: c}
	}

	results, err := cluster.Query(query, queryOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %v", err)
	}
	defer results.Close()

	rows := make([]T, 0)
	for results.Next() {
		var row T
		if err := results.Row(&row); err != nil {
			return nil, fmt.Errorf("error decoding %s: %v", rowErrorMsg, err)
		}
		rows = append(rows, row)
	}
	if err := results.Err(); err != nil {
		return nil, fmt.Errorf("error reading query results: %v", err)
	}

	return rows, nil
}

func buildTagFilters(tags map[string]string) (string, map[string]interface{}) {
	clause := ""
	params := make(map[string]interface{})

	i := 0
	for k, v := range tags {
		if !validTagKey.MatchString(k) {
			continue
		}
		paramName := fmt.Sprintf("tagVal%d", i)
		clause += fmt.Sprintf(` AND m.tags.%s = $%s`, k, paramName)
		params[paramName] = v
		i++
	}

	return clause, params
}