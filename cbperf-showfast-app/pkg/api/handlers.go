package api

import (
	"net/http"
	"strings"

	"github.com/cbperf/showfast/pkg/db"
	"github.com/gin-gonic/gin"
)

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
	builds, err := ds.GetBuilds()
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.IndentedJSON(http.StatusOK, builds)
}

func GetMetricsV2(c *gin.Context, ds *db.DataStore) {
	component := c.Query("component")
	tags := extractTagFromQuery(c)

	metrics, err := ds.GetMetrics(component, tags)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.IndentedJSON(http.StatusOK, metrics)
}

func GetBenchmarksV2(c *gin.Context, ds *db.DataStore) {
	component := c.Query("component")
	tags := extractTagFromQuery(c)
	
	benchmarks, err := ds.GetBenchmarks(component, tags)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.IndentedJSON(http.StatusOK, benchmarks)
}

func GetTimelineV2(c *gin.Context, ds *db.DataStore) {
	metricID := c.Query("metric_id")
	if metricID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error":"metric_id parameter is required"})
		return
	}
	timeline, err := ds.GetTimeline(metricID)
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
		c.JSON(http.StatusBadRequest, gin.H{"error":"metric_id and build parameters are required"})
		return
	}
	runs, err := ds.GetAllRuns(metricID, build)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	
	c.IndentedJSON(http.StatusOK, runs)
}

func CompareV2(c *gin.Context, ds *db.DataStore) {
	build1 := c.Query("build1")
	build2 := c.Query("build2")
	component := c.Query("component")
	if build1 == "" || build2 == "" || component == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error":"build1, build2, and component parameters are required"})
		return
	}
	tags := extractTagFromQuery(c)
	comparison, err := ds.CompareBuilds(build1, build2, component, tags)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.IndentedJSON(http.StatusOK, comparison)
}
