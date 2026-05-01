package db

import (
	"context"
	"fmt"
)

type FilterOptions struct {
	Components    []string
	Categories    []string
	Subcategories []string
	Clusters      []string
	OS            []string
}

func addFilterCondition(query string, params map[string]interface{}, fieldName string, paramName string, values []string) (string, map[string]interface{}) {
	if len(values) > 0 {
		query += fmt.Sprintf(` AND %s IN $%s`, fieldName, paramName)
		params[paramName] = values
	}
	return query, params
}

// getMetricsDimension is a generic getter for metrics dimensions (component, category, subCategory)
func (ds *DataStore) getMetricsDimension(dimension string, opts FilterOptions, c context.Context) ([]string, error) {
	var filterMap map[string][]string
	switch dimension {
	case "component":
		filterMap = map[string][]string{
			"m.category":    opts.Categories,
			"m.subCategory": opts.Subcategories,
		}
	case "category":
		filterMap = map[string][]string{
			"m.component":   opts.Components,
			"m.subCategory": opts.Subcategories,
		}
	case "subCategory":
		filterMap = map[string][]string{
			"m.component": opts.Components,
			"m.category":  opts.Categories,
		}
	default:
		return nil, fmt.Errorf("unknown dimension: %s", dimension)
	}

	query := fmt.Sprintf(`SELECT DISTINCT RAW m.%s FROM metrics m WHERE m.hidden = False`, dimension)
	params := make(map[string]interface{})

	// Apply direct filters
	for field, values := range filterMap {
		paramName := field[2:] // strip "m." prefix for param name
		query, params = addFilterCondition(query, params, field, paramName, values)
	}

	// Cross-table filtering via benchmarks to clusters
	if len(opts.Clusters) > 0 || len(opts.OS) > 0 {
		query += " AND m.id IN (SELECT RAW b.metric FROM benchmarks b JOIN clusters c ON KEYS b.`cluster` WHERE TRUE"
		query, params = addFilterCondition(query, params, "c.name", "clusters", opts.Clusters)
		query, params = addFilterCondition(query, params, "c.os", "os", opts.OS)
		query += `)`
	}

	query += fmt.Sprintf(` ORDER BY m.%s`, dimension)
	return queryRows[string](ds.cluster, query, params, dimension, c)
}

func (ds *DataStore) GetComponents(opts FilterOptions, c context.Context) ([]string, error) {
	return ds.getMetricsDimension("component", opts, c)
}

func (ds *DataStore) GetCategories(opts FilterOptions, c context.Context) ([]string, error) {
	return ds.getMetricsDimension("category", opts, c)
}

func (ds *DataStore) GetSubcategories(opts FilterOptions, c context.Context) ([]string, error) {
	return ds.getMetricsDimension("subCategory", opts, c)
}

func (ds *DataStore) GetOs(opts FilterOptions, c context.Context) ([]string, error) {
	query := "SELECT DISTINCT RAW c.os FROM `clusters` c WHERE c.name IN (SELECT DISTINCT RAW m.`cluster` FROM metrics m WHERE m.hidden = False"
	params := make(map[string]interface{})

	query, params = addFilterCondition(query, params, "m.component", "components", opts.Components)
	query, params = addFilterCondition(query, params, "m.category", "categories", opts.Categories)
	query, params = addFilterCondition(query, params, "m.subCategory", "subcategories", opts.Subcategories)
	query += ")"

	query, params = addFilterCondition(query, params, "c.name", "clusters", opts.Clusters)

	query += ` ORDER BY c.os`
	return queryRows[string](ds.cluster, query, params, "os", c)
}

func (ds *DataStore) GetClusters(opts FilterOptions, c context.Context) ([]string, error) {
	query := "SELECT DISTINCT RAW c.name FROM `clusters` c WHERE c.name IN (SELECT DISTINCT RAW m.`cluster` FROM metrics m WHERE m.hidden = False"
	params := make(map[string]interface{})

	query, params = addFilterCondition(query, params, "m.component", "components", opts.Components)
	query, params = addFilterCondition(query, params, "m.category", "categories", opts.Categories)
	query, params = addFilterCondition(query, params, "m.subCategory", "subcategories", opts.Subcategories)
	query += ")"

	query, params = addFilterCondition(query, params, "c.os", "os", opts.OS)

	query += ` ORDER BY c.name`
	return queryRows[string](ds.cluster, query, params, "cluster", c)
}
