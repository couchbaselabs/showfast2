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
func (h *Handler) GetSubcategoriesV2(c *gin.Context) { h.executeFilterRequest(c, h.ds.GetSubcategories) }
func (h *Handler) GetClustersV2(c *gin.Context) { h.executeFilterRequest(c, h.ds.GetClusters) }
func (h *Handler) GetOsV2(c *gin.Context)       { h.executeFilterRequest(c, h.ds.GetOs) }
func (h *Handler) GetPipelineGroupsV2(c *gin.Context) { h.executeFilterRequest(c, h.ds.GetPipelineGroups) }
func (h *Handler) GetServerMajorMinorsV2(c *gin.Context) { h.executeFilterRequest(c, h.ds.GetServerMajorMinors) }
