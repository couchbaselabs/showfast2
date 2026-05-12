package api

import (
	"context"
	"net/http"
	"strings"

	"github.com/cbperf/showfast/pkg/db"
	"github.com/cbperf/showfast/pkg/models"
	"github.com/gin-gonic/gin"
)

func extractContextFromGin(c *gin.Context) context.Context {
	return c.Request.Context()
}

// parses url query params like tag.foo=v1,v2 or tag.foo=v1&tag.foo=v2
func extractTagsFromQuery(c *gin.Context) map[string][]string {
	tags := make(map[string][]string)
	for key, values := range c.Request.URL.Query() {
		if strings.HasPrefix(key, "tag.") {
			tagKey := strings.TrimPrefix(key, "tag.")
			normalized := make([]string, 0)
			for _, item := range values {
				for _, part := range strings.Split(item, ",") {
					v := strings.TrimSpace(part)
					v = strings.Trim(v, `"`)
					if v != "" {
						normalized = append(normalized, v)
					}
				}
			}
			if len(normalized) > 0 {
				tags[tagKey] = normalized
			}
		}
	}
	return tags
}

func GetBuildsV2(c *gin.Context, ds *db.DataStore) {
	builds, err := ds.GetBuilds(c)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.IndentedJSON(http.StatusOK, builds)
}

func GetMetricsV2(c *gin.Context, ds *db.DataStore) {
	components := queryValues(c, "component")
	tags := extractTagsFromQuery(c)
	ctx := extractContextFromGin(c)

	metrics, err := ds.GetMetrics(components, tags, ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.IndentedJSON(http.StatusOK, metrics)
}

func GetBenchmarksV2(c *gin.Context, ds *db.DataStore) {
	components := queryValues(c, "component")
	tags := extractTagsFromQuery(c)
	ctx := extractContextFromGin(c)

	benchmarks, err := ds.GetBenchmarks(components, tags, ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.IndentedJSON(http.StatusOK, benchmarks)
}

func GetTimelineV2(c *gin.Context, ds *db.DataStore) {
	metricID := c.Param("metricId")
	if metricID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "metric_id parameter is required"})
		return
	}
	ctx := extractContextFromGin(c)
	timeline, err := ds.GetTimeline(metricID, ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.IndentedJSON(http.StatusOK, timeline)
}

func GetTimelinePanelsV2(c *gin.Context, ds *db.DataStore) {
	filters := db.FilterOptions{
		Components:    queryValues(c, "component"),
		Categories:    queryValues(c, "category"),
		Subcategories: queryValues(c, "subcategory"),
		Clusters:      queryValues(c, "cluster"),
		OS:            queryValues(c, "os"),
		Tags:          extractTagsFromQuery(c),
	}

	ctx := extractContextFromGin(c)
	panels, err := ds.GetTimelinePanels(&filters, ctx)

	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.IndentedJSON(http.StatusOK, panels)
}

func GetRunsV2(c *gin.Context, ds *db.DataStore) {
	metricID := c.Query("metric_id")
	build := c.Query("build")
	if metricID == "" || build == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "metric_id and build parameters are required"})
		return
	}
	ctx := extractContextFromGin(c)
	runs, err := ds.GetAllRuns(metricID, build, ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.IndentedJSON(http.StatusOK, runs)
}

func GetFiltersV2(c *gin.Context, ds *db.DataStore) {
	ctx := extractContextFromGin(c)
	filters, err := ds.GetFilters(ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.IndentedJSON(http.StatusOK, filters)
}

func GetClusterInfoV2(c *gin.Context, ds *db.DataStore) {
	clusterName := c.Param("clusterName")
	if clusterName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "clusterName parameter is required"})
		return
	}
	ctx := extractContextFromGin(c)
	cluster, err := ds.GetClusterInfo(clusterName, ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	if cluster == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not found"})
		return
	}
	c.IndentedJSON(http.StatusOK, cluster)
}

func AddMetricV2(c *gin.Context, ds *db.DataStore) {
	var metric models.Metric
	if err := c.ShouldBindJSON(&metric); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := extractContextFromGin(c)
	if err := ds.AddMetric(metric, ctx); err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.IndentedJSON(http.StatusCreated, gin.H{"id": metric.ID})
}

func AddClusterV2(c *gin.Context, ds *db.DataStore) {
	var cluster models.Cluster
	if err := c.ShouldBindJSON(&cluster); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := extractContextFromGin(c)
	if err := ds.AddCluster(cluster, ctx); err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.IndentedJSON(http.StatusCreated, gin.H{"name": cluster.Name})
}

func AddBenchmarkV2(c *gin.Context, ds *db.DataStore) {
	var benchmark models.Benchmark
	if err := c.ShouldBindJSON(&benchmark); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := extractContextFromGin(c)
	if err := ds.AddBenchmark(benchmark, ctx); err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.IndentedJSON(http.StatusCreated, gin.H{"id": benchmark.ID})
}

func UpdateBenchmarkV2(c *gin.Context, ds *db.DataStore) {
	benchmarkID := c.Query("id")
	if benchmarkID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id query parameter is required"})
		return
	}

	ctx := extractContextFromGin(c)
	if err := ds.ToggleBenchmarkHidden(benchmarkID, ctx); err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.IndentedJSON(http.StatusOK, gin.H{"status": "updated"})
}

func DeleteBenchmarkV2(c *gin.Context, ds *db.DataStore) {
	benchmarkID := c.Query("id")
	if benchmarkID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id query parameter is required"})
		return
	}

	ctx := extractContextFromGin(c)
	if err := ds.DeleteBenchmark(benchmarkID, ctx); err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.IndentedJSON(http.StatusOK, gin.H{"status": "deleted"})
}
