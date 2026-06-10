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

const variantsDocID = "cbmonitor:variants"

func componentDocID(id string) string {
	return "cbmonitor:component:" + id
}

// LoadVariantsConfig fetches cbmonitor:variants from _default._default and
// stores it in memory. Safe to call on startup (non-fatal if doc is absent).
func (ds *DataStore) LoadVariantsConfig() error {
	result, err := ds.defaultCollection.Get(variantsDocID, nil)
	if err != nil {
		if errors.Is(err, gocb.ErrDocumentNotFound) {
			return fmt.Errorf("document %q not found — upsert variants config to enable view-driven timelines", variantsDocID)
		}
		return fmt.Errorf("failed to fetch variants config: %w", err)
	}

	var cfg models.VariantsConfig
	if err := result.Content(&cfg); err != nil {
		return fmt.Errorf("failed to decode variants config: %w", err)
	}

	ds.menu.mu.Lock()
	ds.menu.config = &cfg
	ds.menu.mu.Unlock()

	log.DefaultLogger.Info("variants config loaded",
		"variants", len(cfg.Variants),
		"components", len(cfg.Components),
	)
	return nil
}

// GetVariantsConfig returns the cached variants config, or nil if not loaded.
func (ds *DataStore) GetVariantsConfig() *models.VariantsConfig {
	ds.menu.mu.RLock()
	defer ds.menu.mu.RUnlock()
	return ds.menu.config
}

// ReloadVariantsConfig clears the cached config and reloads it from Couchbase.
func (ds *DataStore) ReloadVariantsConfig() error {
	ds.menu.mu.Lock()
	ds.menu.config = nil
	ds.menu.mu.Unlock()
	return ds.LoadVariantsConfig()
}

// GetComponentConfig fetches the cbmonitor:component:{id} document on demand.
// Each doc is small; no in-memory cache is needed beyond the gocb SDK level.
func (ds *DataStore) GetComponentConfig(id string) (*models.ComponentConfig, error) {
	result, err := ds.defaultCollection.Get(componentDocID(id), nil)
	if err != nil {
		if errors.Is(err, gocb.ErrDocumentNotFound) {
			return nil, fmt.Errorf("component doc %q not found", componentDocID(id))
		}
		return nil, fmt.Errorf("failed to fetch component %q: %w", id, err)
	}

	var cfg models.ComponentConfig
	if err := result.Content(&cfg); err != nil {
		return nil, fmt.Errorf("failed to decode component %q: %w", id, err)
	}
	return &cfg, nil
}

// WarmPanelsFromVariants fetches every component config referenced in the
// loaded variants config, then pre-populates the panel cache for every
// component×category pair.
func (ds *DataStore) WarmPanelsFromVariants() {
	variants := ds.GetVariantsConfig()
	if variants == nil {
		log.DefaultLogger.Warn("skipping panel warm — variants config not loaded")
		return
	}

	// Component IDs come directly from the flat list in the variants config.
	compIDs := variants.Components

	// Fetch all component configs in parallel.
	type compResult struct {
		cfg *models.ComponentConfig
	}
	resultCh := make(chan compResult, len(compIDs))
	var fetchWg sync.WaitGroup
	for _, id := range compIDs {
		fetchWg.Add(1)
		go func(compID string) {
			defer fetchWg.Done()
			cfg, err := ds.GetComponentConfig(compID)
			if err != nil {
				log.DefaultLogger.Warn("component config fetch failed during warm", "component", compID, "err", err)
				return
			}
			resultCh <- compResult{cfg}
		}(id)
	}
	go func() {
		fetchWg.Wait()
		close(resultCh)
	}()

	// Build the warm job list — use DBComponentIDs so merged components
	// (e.g. kv querying both "kv" and "kvcloud") are fully warmed.
	type job struct{ component, category string }
	panelSeen := make(map[string]bool)
	var jobs []job
	for r := range resultCh {
		for _, dbComp := range r.cfg.DBComponentIDs() {
			for _, cat := range r.cfg.Categories {
				key := panelCacheKey(dbComp, cat.ID)
				if !panelSeen[key] {
					panelSeen[key] = true
					jobs = append(jobs, job{dbComp, cat.ID})
				}
			}
		}
	}

	// Warm the panel cache.
	sem := make(chan struct{}, panelWarmConcurrency)
	var warmWg sync.WaitGroup
	for _, j := range jobs {
		warmWg.Add(1)
		go func(component, category string) {
			defer warmWg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			_, _ = ds.GetTimelinePanels(&FilterOptions{
				Components: []string{component},
				Categories: []string{category},
			}, context.Background())
		}(j.component, j.category)
	}
	warmWg.Wait()
	log.DefaultLogger.Info("panel cache warmed", "combinations", len(jobs))
}

// ClearPanelCache evicts all cached panel results.
func (ds *DataStore) ClearPanelCache() {
	ds.panels.clear()
}
