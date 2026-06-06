package db

import (
	"sync"

	"github.com/cbperf/showfast/pkg/models"
)

const panelWarmConcurrency = 5

type panelCache struct {
	mu    sync.RWMutex
	store map[string][]models.TimelinePanel
}

func newPanelCache() *panelCache {
	return &panelCache{store: make(map[string][]models.TimelinePanel)}
}

func (pc *panelCache) get(key string) ([]models.TimelinePanel, bool) {
	pc.mu.RLock()
	defer pc.mu.RUnlock()
	v, ok := pc.store[key]
	return v, ok
}

func (pc *panelCache) set(key string, panels []models.TimelinePanel) {
	pc.mu.Lock()
	defer pc.mu.Unlock()
	pc.store[key] = panels
}

func (pc *panelCache) clear() {
	pc.mu.Lock()
	defer pc.mu.Unlock()
	pc.store = make(map[string][]models.TimelinePanel)
}

func panelCacheKey(component, category string) string {
	return component + ":" + category
}

// isPureViewQuery returns true when only a single component+category are set and
// no other filters are active. View-driven timelines always send exactly one
// component and one category, so results are safe to serve from the panel cache.
func isPureViewQuery(filters *FilterOptions) bool {
	return len(filters.Components) == 1 &&
		len(filters.Categories) == 1 &&
		len(filters.Subcategories) == 0 &&
		len(filters.Clusters) == 0 &&
		len(filters.OS) == 0 &&
		len(filters.PipelineGroups) == 0 &&
		len(filters.ServerMajorMinors) == 0 &&
		len(filters.Tags) == 0
}
