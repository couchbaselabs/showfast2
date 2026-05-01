package api

import (
	"net/http"
	"sort"
	"strings"
	"context"

	"github.com/cbperf/showfast/pkg/db"
	"github.com/cbperf/showfast/pkg/models"
	"github.com/gin-gonic/gin"
)

func extractContextFromGin(c *gin.Context) context.Context {
	return c.Request.Context()
}

// parses the url query param for anything starting with "tags.""
func extractTagFromQuery(c *gin.Context) map[string]string {
	tags := make(map[string]string)
	for key, values := range c.Request.URL.Query() {
		if strings.HasPrefix(key, "tag.") && len(values) > 0 {
			tagKey := strings.TrimPrefix(key, "tag.")
			tags[tagKey] = values[0]
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
	component := c.Query("component")
	tags := extractTagFromQuery(c)
	ctx := extractContextFromGin(c)

	metrics, err := ds.GetMetrics(component, tags, ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.IndentedJSON(http.StatusOK, metrics)
}

func GetBenchmarksV2(c *gin.Context, ds *db.DataStore) {
	component := c.Query("component")
	tags := extractTagFromQuery(c)
	ctx := extractContextFromGin(c)

	benchmarks, err := ds.GetBenchmarks(component, tags, ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.IndentedJSON(http.StatusOK, benchmarks)
}

func GetTimelineV2(c *gin.Context, ds *db.DataStore) {
	metricID := c.Query("metric_id")
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

type buildComparison struct {
	Metric string   `json:"metric"`
	Build1 *float64 `json:"build1,omitempty"`
	Build2 *float64 `json:"build2,omitempty"`
	Delta  *float64 `json:"delta,omitempty"`
}

func CompareV2(c *gin.Context, ds *db.DataStore) {
	build1 := c.Query("build1")
	build2 := c.Query("build2")
	component := c.Query("component")
	if build1 == "" || build2 == "" || component == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "build1, build2, and component parameters are required"})
		return
	}

	tags := extractTagFromQuery(c)
	ctx := extractContextFromGin(c)
	benchmarks, err := ds.GetBenchmarks(component, tags, ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	byMetric := make(map[string]*buildComparison)
	for _, benchmark := range benchmarks {
		if benchmark.Build != build1 && benchmark.Build != build2 {
			continue
		}

		comparison, ok := byMetric[benchmark.Metric]
		if !ok {
			comparison = &buildComparison{Metric: benchmark.Metric}
			byMetric[benchmark.Metric] = comparison
		}

		value := benchmark.Value
		if benchmark.Build == build1 {
			comparison.Build1 = &value
		}
		if benchmark.Build == build2 {
			comparison.Build2 = &value
		}
	}

	result := make([]buildComparison, 0, len(byMetric))
	for _, comparison := range byMetric {
		if comparison.Build1 != nil && comparison.Build2 != nil {
			delta := *comparison.Build2 - *comparison.Build1
			comparison.Delta = &delta
		}
		result = append(result, *comparison)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Metric < result[j].Metric
	})

	c.IndentedJSON(http.StatusOK, result)
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

// func GetFilteredMetrics(c *gin.Context, ds *db.DataStore) {
// 	extractedComponent := c.Query("component")
// 	extractedCategory := c.Query("category")
// 	extractedSubcategory := c.Query("subcategory")
// 	extractedCluster := c.Query("cluster")
// 	extractedOS := c.Query("os")
// 	extractedBuild := c.Query("build")

// 	tags := extractTagFromQuery(c)
// 	ctx := extractContextFromGin(c)

// 	metrics, err := ds.GetFilteredMetrics(tags, ctx)
// 	if err != nil {
// 		c.AbortWithError(http.StatusInternalServerError, err)
// 		return
// 	}

// 	c.IndentedJSON(http.StatusOK, metrics)
// }

type Filters struct {
	
}
