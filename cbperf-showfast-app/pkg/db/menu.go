package db

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/cbperf/showfast/pkg/models"
	"github.com/couchbase/gocb/v2"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

const menuConfigDocID = "cbmonitor:menu_config"

// LoadMenuConfig fetches the menu config document from _default._default and
// stores it in memory. Safe to call on startup (non-fatal if doc is absent).
func (ds *DataStore) LoadMenuConfig() error {
	result, err := ds.defaultCollection.Get(menuConfigDocID, nil)
	if err != nil {
		if errors.Is(err, gocb.ErrDocumentNotFound) {
			return fmt.Errorf("document %q not found in _default._default — insert menu config to enable view-driven timelines", menuConfigDocID)
		}
		return fmt.Errorf("failed to fetch menu config: %w", err)
	}

	var config models.MenuConfig
	if err := result.Content(&config); err != nil {
		return fmt.Errorf("failed to decode menu config: %w", err)
	}

	ds.menu.mu.Lock()
	ds.menu.config = &config
	ds.menu.mu.Unlock()

	nComponents, nCategories := 0, 0
	for _, variant := range config.Variants {
		nComponents += len(variant.Components)
		for _, comp := range variant.Components {
			nCategories += len(comp.Categories)
		}
	}
	// note: nComponents double-counts components shared across variants; that's fine for logging
	log.DefaultLogger.Info("menu config loaded",
		"variants", len(config.Variants),
		"components", nComponents,
		"categories", nCategories,
	)
	return nil
}

// GetMenuConfig returns the cached menu config, or nil if not yet loaded.
func (ds *DataStore) GetMenuConfig() *models.MenuConfig {
	ds.menu.mu.RLock()
	defer ds.menu.mu.RUnlock()
	return ds.menu.config
}

// ReloadMenuConfig clears the cached config and reloads it from Couchbase.
func (ds *DataStore) ReloadMenuConfig() error {
	ds.menu.mu.Lock()
	ds.menu.config = nil
	ds.menu.mu.Unlock()
	return ds.LoadMenuConfig()
}

// WarmPanelsFromMenu iterates every component×category pair in the loaded menu
// and pre-populates the panel cache. Limited to panelWarmConcurrency concurrent
// Couchbase queries to avoid overloading the cluster at startup.
func (ds *DataStore) WarmPanelsFromMenu() {
	menu := ds.GetMenuConfig()
	if menu == nil {
		log.DefaultLogger.Warn("skipping panel warm — menu config not loaded")
		return
	}

	type job struct{ component, category string }
	seen := make(map[string]bool)
	var jobs []job
	for _, variant := range menu.Variants {
		for _, comp := range variant.Components {
			for _, cat := range comp.Categories {
				key := panelCacheKey(comp.ID, cat.ID)
				if !seen[key] {
					seen[key] = true
					jobs = append(jobs, job{comp.ID, cat.ID})
				}
			}
		}
	}

	sem := make(chan struct{}, panelWarmConcurrency)
	var wg sync.WaitGroup
	for _, j := range jobs {
		wg.Add(1)
		go func(component, category string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			_, _ = ds.GetTimelinePanels(&FilterOptions{
				Components: []string{component},
				Categories: []string{category},
			}, context.Background())
		}(j.component, j.category)
	}
	wg.Wait()
	log.DefaultLogger.Info("panel cache warmed", "combinations", len(jobs))
}

// ClearPanelCache evicts all cached panel results.
func (ds *DataStore) ClearPanelCache() {
	ds.panels.clear()
}
