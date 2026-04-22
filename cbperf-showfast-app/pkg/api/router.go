package api

import (
	"github.com/cbperf/showfast/pkg/db"
	"github.com/gin-gonic/gin"
)

func SetupRouter(ds *db.DataStore) *gin.Engine {
	router := gin.Default()

	v2 := router.Group("/api/v2")
	{
		v2.GET("/builds", func(c *gin.Context) { GetBuildsV2(c, ds) })
		v2.GET("/metrics", func(c *gin.Context) { GetMetricsV2(c, ds) })
		v2.GET("/benchmarks", func(c *gin.Context) { GetBenchmarksV2(c, ds) })
		v2.GET("/timeline", func(c *gin.Context) { GetTimelineV2(c, ds) })
		v2.GET("/runs", func(c *gin.Context) { GetRunsV2(c, ds) })
		v2.GET("/compare", func(c *gin.Context) { CompareV2(c, ds) })
	}

	return router
}
