package api

import (
	"net/http"

	"github.com/cbperf/showfast/pkg/db"
	"github.com/gin-gonic/gin"
)

func parseFilterOptions(c *gin.Context) db.FilterOptions {
	return db.FilterOptions{
		Components:    c.QueryArray("component"),
		Categories:    c.QueryArray("category"),
		Subcategories: c.QueryArray("subcategory"),
		Clusters:      c.QueryArray("cluster"),
		OS:            c.QueryArray("os"),
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
