package api

import (
	"github.com/cbperf/showfast/pkg/db"
	"github.com/gin-gonic/gin"
)

func SetupRouter(ds *db.DataStore) *gin.Engine {
	router := gin.Default()
	
	router.GET("/builds", func(c *gin.Context) { GetBuildsV2(c, ds) })
	router.GET("/metrics", func(c *gin.Context) { GetMetricsV2(c, ds) })
	router.GET("/benchmarks", func(c *gin.Context) { GetBenchmarksV2(c, ds) })
	router.GET("/timeline", func(c *gin.Context) { GetTimelineV2(c, ds) })
	router.GET("/runs", func(c *gin.Context) { GetRunsV2(c, ds) })
	router.GET("/filters", func(c *gin.Context) { GetFiltersV2(c, ds) })

	router.POST("/metrics", func(c *gin.Context) { AddMetricV2(c, ds) })
	router.POST("/clusters", func(c *gin.Context) { AddClusterV2(c, ds) })
	router.POST("/benchmarks", func(c *gin.Context) { AddBenchmarkV2(c, ds) })

	router.PATCH("/benchmarks", func(c *gin.Context) { UpdateBenchmarkV2(c, ds) })
	
	router.DELETE("/benchmarks", func(c *gin.Context) { DeleteBenchmarkV2(c, ds) })

	utils := router.Group("/utils")
	{
		utils.GET("/components", func(c *gin.Context) { GetComponentsV2(c, ds) })
		utils.GET("/categories", func(c *gin.Context) { GetCategoriesV2(c, ds) })
		utils.GET("/subcategories", func(c *gin.Context) { GetSubcategoriesV2(c, ds) })
		utils.GET("/clusters", func(c *gin.Context) { GetClustersV2(c, ds) })	
		utils.GET("/os", func(c *gin.Context) { GetOsV2(c, ds) })	
	}

	return router
}
