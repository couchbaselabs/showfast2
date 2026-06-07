package db

import (
	"sort"
	"strings"
	"sync"
)

type filterCache struct {
	mu    sync.RWMutex
	store map[string][]string
}

func newFilterCache() *filterCache {
	return &filterCache{store: make(map[string][]string)}
}

func (fc *filterCache) get(key string) ([]string, bool) {
	fc.mu.RLock()
	defer fc.mu.RUnlock()
	v, ok := fc.store[key]
	return v, ok
}

func (fc *filterCache) set(key string, values []string) {
	fc.mu.Lock()
	defer fc.mu.Unlock()
	fc.store[key] = values
}

func (fc *filterCache) clear() {
	fc.mu.Lock()
	defer fc.mu.Unlock()
	fc.store = make(map[string][]string)
}

func sortedJoin(s []string) string {
	if len(s) == 0 {
		return ""
	}
	cp := make([]string, len(s))
	copy(cp, s)
	sort.Strings(cp)
	return strings.Join(cp, ",")
}

func filterCacheKey(column string, opts FilterOptions) string {
	// Serialize tags in deterministic order.
	tagParts := make([]string, 0, len(opts.Tags))
	for k, vs := range opts.Tags {
		tagParts = append(tagParts, k+":"+sortedJoin(vs))
	}
	sort.Strings(tagParts)

	hiddenFlags := ""
	if opts.ShowHiddenMetrics {
		hiddenFlags += "hm"
	}
	if opts.ShowHiddenBenchmarks {
		hiddenFlags += "hb"
	}

	return strings.Join([]string{
		column,
		hiddenFlags,
		sortedJoin(opts.Components),
		sortedJoin(opts.Categories),
		sortedJoin(opts.Subcategories),
		sortedJoin(opts.Clusters),
		sortedJoin(opts.OS),
		sortedJoin(opts.PipelineGroups),
		sortedJoin(opts.ServerMajorMinors),
		strings.Join(tagParts, ";"),
	}, "|")
}
