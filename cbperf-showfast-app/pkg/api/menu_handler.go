package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) GetMenu(c *gin.Context) {
	menu := h.ds.GetMenuConfig()
	if menu == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": `menu config not loaded — insert document "cbmonitor:menu_config" into _default._default`,
		})
		return
	}
	c.JSON(http.StatusOK, menu)
}

func (h *Handler) ReloadMenu(c *gin.Context) {
	if err := h.ds.ReloadMenuConfig(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.ds.ClearPanelCache()
	go h.ds.WarmPanelsFromMenu()
	c.JSON(http.StatusOK, gin.H{"status": "reloading"})
}
