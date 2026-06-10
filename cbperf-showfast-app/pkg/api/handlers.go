package api

import (
	"context"
	"net/http"
	"strconv"
	"strings"

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
	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return h.ds.GetBuilds(ctx)
	})
}

func (h *Handler) GetMetricsV2(c *gin.Context) {
	components := queryValues(c, "component")
	tags := extractTagsFromQuery(c)
	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return h.ds.GetMetrics(components, tags, ctx)
	})
}

func (h *Handler) GetBenchmarksV2(c *gin.Context) {
	components := queryValues(c, "component")
	tags := extractTagsFromQuery(c)
	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return h.ds.GetBenchmarks(components, tags, ctx)
	})
}

func (h *Handler) GetTimelineV2(c *gin.Context) {
	metricID := c.Param("metricId")
	if metricID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "metric_id parameter is required"})
		return
	}

	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return h.ds.GetTimeline(metricID, ctx)
	})
}

func (h *Handler) GetTimelinePanelsV2(c *gin.Context) {
	filters := parseFilterOptions(c)
	limitStr := c.Query("limit")

	if limitStr == "" {
		// No pagination: return plain array (component view path).
		executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
			return h.ds.GetTimelinePanels(&filters, ctx)
		})
		return
	}

	// Pagination requested: use datastore-level paginated method
	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return h.ds.GetTimelinePanelsWithPagination(&filters, limit, offset, ctx)
	})
}

func (h *Handler) GetRunsV2(c *gin.Context) {
	metricID := c.Query("metric_id")
	build := c.Query("build")
	if metricID == "" || build == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "metric_id and build parameters are required"})
		return
	}

	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return h.ds.GetAllRuns(metricID, build, ctx)
	})
}

func (h *Handler) GetFiltersV2(c *gin.Context) {
	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return h.ds.GetFilters(ctx)
	})
}

func (h *Handler) GetRunDetailV2(c *gin.Context) {
	runID, ok := requireQueryParam(c, "runId")
	if !ok {
		return
	}
	metricID, ok := requireQueryParam(c, "metricId")
	if !ok {
		return
	}

	ctx := extractContextFromGin(c)
	detail, err := h.ds.GetRunDetail(runID, metricID, ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if detail == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, detail)
}

func (h *Handler) GetClusterInfoV2(c *gin.Context) {
	clusterID, ok := requirePathParam(c, "clusterId")
	if !ok {
		return
	}
	ctx := extractContextFromGin(c)
	cluster, err := h.ds.GetClusterInfo(clusterID, ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
	if !bindJSONOrAbort(c, &metric) {
		return
	}

	executeAndRespond(c, http.StatusCreated, func(ctx context.Context) (interface{}, error) {
		if err := h.ds.AddMetric(metric, ctx); err != nil {
			return nil, err
		}

		return gin.H{"id": metric.ID}, nil
	})
}

func (h *Handler) AddClusterV2(c *gin.Context) {
	var cluster models.Cluster
	if !bindJSONOrAbort(c, &cluster) {
		return
	}
	cluster.ID = strings.TrimSpace(cluster.ID)
	if cluster.ID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	executeAndRespond(c, http.StatusCreated, func(ctx context.Context) (interface{}, error) {
		if err := h.ds.AddCluster(cluster, ctx); err != nil {
			return nil, err
		}

		return gin.H{"name": cluster.Name}, nil
	})
}

func (h *Handler) AddBenchmarkV2(c *gin.Context) {
	var benchmark models.Benchmark
	if !bindJSONOrAbort(c, &benchmark) {
		return
	}
	if benchmark.RunID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "runId is required"})
		return
	}

	executeAndRespond(c, http.StatusCreated, func(ctx context.Context) (interface{}, error) {
		if err := h.ds.AddBenchmark(benchmark, ctx); err != nil {
			return nil, err
		}

		return gin.H{"id": benchmark.ID}, nil
	})
}

func (h *Handler) AddTestV2(c *gin.Context) {
	var test models.Test
	if !bindJSONOrAbort(c, &test) {
		return
	}
	test.ID = strings.TrimSpace(test.ID)
	if test.ID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	executeAndRespond(c, http.StatusCreated, func(ctx context.Context) (interface{}, error) {
		if err := h.ds.AddTest(test, ctx); err != nil {
			return nil, err
		}

		return gin.H{"id": test.ID}, nil
	})
}

func (h *Handler) AddBuildV2(c *gin.Context) {
	var build models.Build
	if !bindJSONOrAbort(c, &build) {
		return
	}
	build.ID = strings.TrimSpace(build.ID)
	if build.ID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	executeAndRespond(c, http.StatusCreated, func(ctx context.Context) (interface{}, error) {
		if err := h.ds.AddBuild(build, ctx); err != nil {
			return nil, err
		}

		return gin.H{"id": build.ID}, nil
	})
}

func (h *Handler) AddRunV2(c *gin.Context) {
	var run models.RunDoc
	if !bindJSONOrAbort(c, &run) {
		return
	}
	run.ID = strings.TrimSpace(run.ID)
	if run.ID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	executeAndRespond(c, http.StatusCreated, func(ctx context.Context) (interface{}, error) {
		if err := h.ds.AddRun(run, ctx); err != nil {
			return nil, err
		}

		return gin.H{"id": run.ID}, nil
	})
}

func (h *Handler) UpdateBenchmarkV2(c *gin.Context) {
	benchmarkID, ok := requireQueryParam(c, "id")
	if !ok {
		return
	}

	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		if err := h.ds.ToggleBenchmarkHidden(benchmarkID, ctx); err != nil {
			return nil, err
		}

		return gin.H{"status": "updated"}, nil
	})
}

func (h *Handler) DeleteBenchmarkV2(c *gin.Context) {
	benchmarkID, ok := requireQueryParam(c, "id")
	if !ok {
		return
	}

	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		if err := h.ds.DeleteBenchmark(benchmarkID, ctx); err != nil {
			return nil, err
		}

		return gin.H{"status": "deleted"}, nil
	})
}
