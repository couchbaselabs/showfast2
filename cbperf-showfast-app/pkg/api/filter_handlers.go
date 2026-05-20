package api

import (
	"net/http"
	"context"

	"github.com/gin-gonic/gin"
	"github.com/cbperf/showfast/pkg/db"
)

func (h *Handler) executeFilterRequest(c *gin.Context, fetchFunc func(db.FilterOptions, context.Context) ([]string, error)) {
	opts := parseFilterOptions(c)
	ctx := extractContextFromGin(c)

	results, err := fetchFunc(opts, ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

func (h *Handler) GetComponentsV2(c *gin.Context) { h.executeFilterRequest(c, h.ds.GetComponents)}
func (h *Handler) GetCategoriesV2(c *gin.Context) { h.executeFilterRequest(c, h.ds.GetCategories) }
func (h *Handler) GetSubcategoriesV2(c *gin.Context) { h.executeFilterRequest(c, h.ds.GetSubcategories) }
func (h *Handler) GetClustersV2(c *gin.Context) { h.executeFilterRequest(c, h.ds.GetClusters) }
func (h *Handler) GetOsV2(c *gin.Context) { h.executeFilterRequest(c, h.ds.GetOs) }
