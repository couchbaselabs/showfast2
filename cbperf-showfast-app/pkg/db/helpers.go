package db

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/couchbase/gocb/v2"
)

// queryRows executes a query and reads all rows into a slice, with consistent error handling
func queryRows[T any](cluster *gocb.Cluster, query string, params map[string]interface{}, rowErrorMsg string, c context.Context) ([]T, error) {
	queryOpts := &gocb.QueryOptions{Context: c}
	if params != nil {
		queryOpts.NamedParameters = params
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
		// Quote tag key identifiers so reserved words like `group` are valid.
		clause += fmt.Sprintf(" AND m.tags.`%s` IN $%s", k, paramName)
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

func addComponentAndTagFilterConditions(query string, params map[string]interface{}, components []string, tags map[string][]string) (string, map[string]interface{}) {
	query, params = addFilterCondition(query, params, "m.component", "components", components)

	tagClause, tagParams := buildTagFilters(tags)
	query += tagClause
	for k, v := range tagParams {
		params[k] = v
	}

	return query, params
}

func addGenericFilterConditions(query string, params map[string]interface{}, opts FilterOptions, fieldNames map[string]string, skipColumns map[string]bool) (string, map[string]interface{}) {
	for _, spec := range GenericFilterSpecs {
		if skipColumns != nil && skipColumns[spec.column] {
			continue
		}

		fieldName, ok := fieldNames[spec.column]
		if !ok {
			continue
		}

		query, params = addFilterCondition(query, params, fieldName, spec.param, spec.values(opts))
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
	case "pipelinegroup", "pipeline_group", "pipelineGroup":
		return "pipelineGroup", nil
	case "servermajorminor", "server_major_minor", "serverMajorMinor":
		return "serverMajorMinor", nil
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

func compareSemanticBuild(a, b string) int {
	return compareSemanticBuildCached(a, b, nil)
}

type semanticBuildParse struct {
	parts [4]int
	ok    bool
}

func parsedSemanticBuild(build string, cache map[string]semanticBuildParse) ([4]int, bool) {
	if cache != nil {
		if parsed, found := cache[build]; found {
			return parsed.parts, parsed.ok
		}
	}

	pa, okA := parseSemanticBuild(build)
	if cache != nil {
		cache[build] = semanticBuildParse{parts: pa, ok: okA}
	}
	return pa, okA
}

func compareSemanticBuildCached(a, b string, cache map[string]semanticBuildParse) int {
	pa, okA := parsedSemanticBuild(a, cache)
	pb, okB := parsedSemanticBuild(b, cache)

	if okA && okB {
		if pa[0] != pb[0] {
			return pa[0] - pb[0]
		}
		if pa[1] != pb[1] {
			return pa[1] - pb[1]
		}
		if pa[2] != pb[2] {
			return pa[2] - pb[2]
		}
		if pa[3] != pb[3] {
			return pa[3] - pb[3]
		}
		return 0
	}

	if okA != okB {
		if okA {
			return 1
		}
		return -1
	}

	return strings.Compare(a, b)
}

func parseSemanticBuild(build string) ([4]int, bool) {
	var parts [4]int

	ver, buildStr, ok := strings.Cut(build, "-")
	if !ok {
		return parts, false
	}
	major, rest, ok := strings.Cut(ver, ".")
	if !ok {
		return parts, false
	}
	minor, patch, ok := strings.Cut(rest, ".")
	if !ok {
		return parts, false
	}

	var err error
	if parts[0], err = strconv.Atoi(major); err != nil {
		return parts, false
	}
	if parts[1], err = strconv.Atoi(minor); err != nil {
		return parts, false
	}
	if parts[2], err = strconv.Atoi(patch); err != nil {
		return parts, false
	}
	if parts[3], err = strconv.Atoi(buildStr); err != nil {
		return parts, false
	}
	return parts, true
}

func sortBuildStringsDesc(builds []string) {
	sort.SliceStable(builds, func(i, j int) bool {
		return compareSemanticBuild(builds[i], builds[j]) > 0
	})
}
