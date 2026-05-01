package api

import (
	"net/http"
	"strings"

	"github.com/cbperf/showfast/pkg/db"
	"github.com/gin-gonic/gin"
)

// queryValues supports both repeated params (?component=kv&component=index)
// and comma-separated (?component=kv,index,fts) for convenience with pill dropdowns.
func queryValues(c *gin.Context, key string) []string {
	raw := c.QueryArray(key)
	values := make([]string, 0, len(raw))

	for _, item := range raw {
		for _, part := range strings.Split(item, ",") {
			v := strings.TrimSpace(part)
			v = strings.Trim(v, `"`)
			if v != "" {
				values = append(values, v)
			}
		}
	}

	return values
}

func parseFilterOptions(c *gin.Context) db.FilterOptions {
	return db.FilterOptions{
		Components:    queryValues(c, "component"),
		Categories:    queryValues(c, "category"),
		Subcategories: queryValues(c, "subcategory"),
		Clusters:      queryValues(c, "cluster"),
		OS:            queryValues(c, "os"),
	}
}

func GetComponentsV2(c *gin.Context, ds *db.DataStore) {
	ctx := extractContextFromGin(c)
	opts := parseFilterOptions(c)
	components, err := ds.GetComponents(opts, ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.IndentedJSON(http.StatusOK, components)
}

func GetCategoriesV2(c *gin.Context, ds *db.DataStore) {
	ctx := extractContextFromGin(c)
	opts := parseFilterOptions(c)
	categories, err := ds.GetCategories(opts, ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.IndentedJSON(http.StatusOK, categories)
}

func GetSubcategoriesV2(c *gin.Context, ds *db.DataStore) {
	ctx := extractContextFromGin(c)
	opts := parseFilterOptions(c)
	subcategories, err := ds.GetSubcategories(opts, ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.IndentedJSON(http.StatusOK, subcategories)
}

func GetClustersV2(c *gin.Context, ds *db.DataStore) {
	ctx := extractContextFromGin(c)
	opts := parseFilterOptions(c)
	clusters, err := ds.GetClusters(opts, ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.IndentedJSON(http.StatusOK, clusters)
}

func GetOsV2(c *gin.Context, ds *db.DataStore) {
	ctx := extractContextFromGin(c)
	opts := parseFilterOptions(c)
	osList, err := ds.GetOs(opts, ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.IndentedJSON(http.StatusOK, osList)
}
