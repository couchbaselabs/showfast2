package api

import (
	"context"
	"net/http"

	"github.com/cbperf/showfast/pkg/db"
	"github.com/gin-gonic/gin"
)

func (h *Handler) executeFilterRequest(c *gin.Context, fetchFunc func(db.FilterOptions, context.Context) ([]string, error)) {
	opts := parseFilterOptions(c)
	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return fetchFunc(opts, ctx)
	})
}

func (h *Handler) GetComponentsV2(c *gin.Context) { h.executeFilterRequest(c, h.ds.GetComponents) }
func (h *Handler) GetCategoriesV2(c *gin.Context) { h.executeFilterRequest(c, h.ds.GetCategories) }
func (h *Handler) GetSubcategoriesV2(c *gin.Context) {
	h.executeFilterRequest(c, h.ds.GetSubcategories)
}
func (h *Handler) GetClustersV2(c *gin.Context) { h.executeFilterRequest(c, h.ds.GetClusters) }
func (h *Handler) GetOsV2(c *gin.Context)        { h.executeFilterRequest(c, h.ds.GetOs) }
func (h *Handler) GetPipelineGroupsV2(c *gin.Context) {
	h.executeFilterRequest(c, h.ds.GetPipelineGroups)
}
func (h *Handler) GetServerMajorMinorsV2(c *gin.Context) {
	h.executeFilterRequest(c, h.ds.GetServerMajorMinors)
}

func (h *Handler) GetFiltersBulkV2(c *gin.Context) {
	opts := parseFilterOptions(c)
	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return h.ds.GetFiltersBulk(opts, ctx)
	})
}

// ReloadFiltersV2 clears the filter cache and re-warms it in the background.
// Returns immediately — the warm happens asynchronously.
func (h *Handler) ReloadFiltersV2(c *gin.Context) {
	h.ds.ReloadFilterCache()
	c.JSON(http.StatusOK, gin.H{"status": "reloading"})
}
