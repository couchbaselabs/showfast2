package api

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) GetWeeklyBuildsV2(c *gin.Context) {
	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return h.ds.GetWeeklyBuilds(ctx)
	})
}

func (h *Handler) GetWeeklyDetailV2(c *gin.Context) {
	build, ok := requireQueryParam(c, "build")
	if !ok {
		return
	}
	executeAndRespond(c, http.StatusOK, func(ctx context.Context) (interface{}, error) {
		return h.ds.GetWeeklyDetail(ctx, build)
	})
}
