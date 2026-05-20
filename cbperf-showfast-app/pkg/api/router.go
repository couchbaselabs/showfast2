package api

import (
	"github.com/cbperf/showfast/pkg/db"
	"github.com/gin-gonic/gin"
)

func SetupRouter(ds *db.DataStore) *gin.Engine {
	router := gin.Default()
	h := NewHandler(ds)
	
	router.GET("/builds", h.GetBuildsV2)
	router.GET("/metrics", h.GetMetricsV2)
	router.GET("/benchmarks", h.GetBenchmarksV2)
	router.GET("/timeline/:metricId", h.GetTimelineV2)
	router.GET("/timelines/panels", h.GetTimelinePanelsV2)
	router.GET("/runs", h.GetRunsV2)
	router.GET("/filters", h.GetFiltersV2)
	router.GET("/cluster/:clusterName", h.GetClusterInfoV2)

	router.POST("/metrics", h.AddMetricV2)
	router.POST("/clusters", h.AddClusterV2)
	router.POST("/benchmarks", h.AddBenchmarkV2)

	router.PATCH("/benchmarks", h.UpdateBenchmarkV2)
	
	router.DELETE("/benchmarks", h.DeleteBenchmarkV2)

	utils := router.Group("/utils")
	{
		utils.GET("/components", h.GetComponentsV2)
		utils.GET("/categories", h.GetCategoriesV2)
		utils.GET("/subcategories", h.GetSubcategoriesV2)
		utils.GET("/clusters", h.GetClustersV2)	
		utils.GET("/os", h.GetOsV2)	
	}

	return router
}
