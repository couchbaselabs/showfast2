package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) GetTestsRanLastMonthSummaryV2(c *gin.Context) {
	ctx := extractContextFromGin(c)
	count, err := h.ds.GetTestsRanLastMonthCount(ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"testsRanLastMonth": count})
}

func (h *Handler) GetTestsRanForEachComponentLast2WeeksV2(c *gin.Context) {
	ctx := extractContextFromGin(c)
	results, err := h.ds.GetTestsRanForEachComponentLast2Weeks(ctx)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, results)
}