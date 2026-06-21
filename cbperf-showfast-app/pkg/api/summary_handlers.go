package api

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func (h *Handler) GetTestsRanLastMonthSummaryV2(c *gin.Context) {
	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		count, err := h.ds.GetTestsRanLastMonthCount(ctx)
		if err != nil {
			return nil, err
		}

		return gin.H{"testsRanLastMonth": count}, nil
	})
}

func (h *Handler) GetTestsRanForEachComponentLast2WeeksV2(c *gin.Context) {
	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return h.ds.GetTestsRanForEachComponentLast2Weeks(ctx)
	})
}

func (h *Handler) GetDailyComponentStatusV2(c *gin.Context) {
	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return h.ds.GetDailyPipelineSummary(ctx)
	})
}

func (h *Handler) GetWeeklyComponentStatusV2(c *gin.Context) {
	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return h.ds.GetWeeklyPipelineSummary(ctx)
	})
}

func (h *Handler) GenerateWeeklyDocsV2(c *gin.Context) {
	build := c.Query("build")
	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return h.ds.GenerateWeeklyDocs(ctx, build)
	})
}

func (h *Handler) GetJenkinsRunsV2(c *gin.Context) {
	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		limit := 100
		if raw := c.Query("limit"); raw != "" {
			if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= 200 {
				limit = n
			}
		}
		return h.ds.GetJenkinsRuns(ctx, limit)
	})
}
