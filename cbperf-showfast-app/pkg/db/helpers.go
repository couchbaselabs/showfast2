package db

import (
	"context"
	"fmt"
	"strings"

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

func buildTagFilters(tags map[string][]string) (string, map[string]interface{}) {
	clause := ""
	params := make(map[string]interface{})

	i := 0
	for k, values := range tags {
		if !validTagKey.MatchString(k) {
			continue
		}
		if len(values) == 0 {
			continue
		}
		paramName := fmt.Sprintf("tagVal%d", i)
		clause += fmt.Sprintf(` AND m.tags.%s IN $%s`, k, paramName)
		params[paramName] = values
		i++
	}

	return clause, params
}

func addFilterCondition(query string, params map[string]interface{}, fieldName string, paramName string, values []string) (string, map[string]interface{}) {
	if len(values) > 0 {
		query += fmt.Sprintf(` AND %s IN $%s`, fieldName, paramName)
		params[paramName] = values
	}
	return query, params
}

func normalizeGenericFilterColumn(filter string) (string, error) {
	// Accept either API-style names (subcategory, cluster) or DB column names.
	switch strings.ToLower(strings.TrimSpace(filter)) {
	case "component":
		return "component", nil
	case "category":
		return "category", nil
	case "subcategory", "sub_category", "subCategory":
		return "subCategory", nil
	case "os":
		return "os", nil
	case "cluster", "clusters", "name":
		return "name", nil
	default:
		return "", fmt.Errorf("unsupported filter: %s", filter)
	}
}

// semanticBuildOrder returns an ORDER BY clause that sorts build strings numerically.
// Parses versions like "7.2.77-1000" into major.minor.patch-buildNo and orders numerically.
// buildField: e.g. "b.`build`" or just "build"
// direction: e.g. "ASC" or "DESC"
func semanticBuildOrder(buildField, direction string) string {
	return fmt.Sprintf(
		"TO_NUMBER(SPLIT(SPLIT(%s, \"-\")[0], \".\")[0]) %s, "+
			"TO_NUMBER(SPLIT(SPLIT(%s, \"-\")[0], \".\")[1]) %s, "+
			"TO_NUMBER(SPLIT(SPLIT(%s, \"-\")[0], \".\")[2]) %s, "+
			"TO_NUMBER(SPLIT(%s, \"-\")[1]) %s",
		buildField, "ASC",
		buildField, "ASC",
		buildField, "ASC",
		buildField, direction,
	)
}
