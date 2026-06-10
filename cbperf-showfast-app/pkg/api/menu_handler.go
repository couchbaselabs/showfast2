package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) GetVariants(c *gin.Context) {
	cfg := h.ds.GetVariantsConfig()
	if cfg == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": `variants config not loaded — upsert document "cbmonitor:variants" into _default._default`,
		})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

func (h *Handler) GetComponent(c *gin.Context) {
	id := c.Param("id")
	cfg, err := h.ds.GetComponentConfig(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

func (h *Handler) ReloadMenu(c *gin.Context) {
	if err := h.ds.ReloadVariantsConfig(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.ds.ClearPanelCache()
	go h.ds.WarmPanelsFromVariants()
	c.JSON(http.StatusOK, gin.H{"status": "reloading"})
}
