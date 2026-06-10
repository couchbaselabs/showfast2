package api

import (
	"context"
	"net/http"

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
