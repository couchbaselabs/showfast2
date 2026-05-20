package api

import (
	"net/http"

	"github.com/cbperf/showfast/pkg/db"
	"github.com/cbperf/showfast/pkg/models"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	ds *db.DataStore
}

func NewHandler(ds *db.DataStore) *Handler {
	return &Handler{ds: ds}
}

func (h *Handler) GetBuildsV2(c *gin.Context) {
	builds, err := h.ds.GetBuilds(c)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, builds)
}

func (h *Handler) GetMetricsV2(c *gin.Context) {
	components := queryValues(c, "component")
	tags := extractTagsFromQuery(c)
	ctx := extractContextFromGin(c)

	metrics, err := h.ds.GetMetrics(components, tags, ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, metrics)
}

func (h *Handler) GetBenchmarksV2(c *gin.Context) {
	components := queryValues(c, "component")
	tags := extractTagsFromQuery(c)
	ctx := extractContextFromGin(c)

	benchmarks, err := h.ds.GetBenchmarks(components, tags, ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, benchmarks)
}

func (h *Handler) GetTimelineV2(c *gin.Context) {
	metricID := c.Param("metricId")
	if metricID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "metric_id parameter is required"})
		return
	}
	ctx := extractContextFromGin(c)
	timeline, err := h.ds.GetTimeline(metricID, ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, timeline)
}

func (h *Handler) GetTimelinePanelsV2(c *gin.Context) {
	filters := parseFilterOptions(c)

	ctx := extractContextFromGin(c)
	panels, err := h.ds.GetTimelinePanels(&filters, ctx)

	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, panels)
}

func (h *Handler) GetRunsV2(c *gin.Context) {
	metricID := c.Query("metric_id")
	build := c.Query("build")
	if metricID == "" || build == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "metric_id and build parameters are required"})
		return
	}
	ctx := extractContextFromGin(c)
	runs, err := h.ds.GetAllRuns(metricID, build, ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, runs)
}

func (h *Handler) GetFiltersV2(c *gin.Context) {
	ctx := extractContextFromGin(c)
	filters, err := h.ds.GetFilters(ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, filters)
}

func (h *Handler) GetClusterInfoV2(c *gin.Context) {
	clusterName := c.Param("clusterName")
	if clusterName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "clusterName parameter is required"})
		return
	}
	ctx := extractContextFromGin(c)
	cluster, err := h.ds.GetClusterInfo(clusterName, ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	if cluster == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not found"})
		return
	}
	c.JSON(http.StatusOK, cluster)
}

func (h *Handler) AddMetricV2(c *gin.Context) {
	var metric models.Metric
	if err := c.ShouldBindJSON(&metric); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := extractContextFromGin(c)
	if err := h.ds.AddMetric(metric, ctx); err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": metric.ID})
}

func (h *Handler) AddClusterV2(c *gin.Context) {
	var cluster models.Cluster
	if err := c.ShouldBindJSON(&cluster); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := extractContextFromGin(c)
	if err := h.ds.AddCluster(cluster, ctx); err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"name": cluster.Name})
}

func (h *Handler) AddBenchmarkV2(c *gin.Context) {
	var benchmark models.Benchmark
	if err := c.ShouldBindJSON(&benchmark); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := extractContextFromGin(c)
	if err := h.ds.AddBenchmark(benchmark, ctx); err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": benchmark.ID})
}

func (h *Handler) UpdateBenchmarkV2(c *gin.Context) {
	benchmarkID := c.Query("id")
	if benchmarkID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id query parameter is required"})
		return
	}

	ctx := extractContextFromGin(c)
	if err := h.ds.ToggleBenchmarkHidden(benchmarkID, ctx); err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func (h *Handler) DeleteBenchmarkV2(c *gin.Context) {
	benchmarkID := c.Query("id")
	if benchmarkID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id query parameter is required"})
		return
	}

	ctx := extractContextFromGin(c)
	if err := h.ds.DeleteBenchmark(benchmarkID, ctx); err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
