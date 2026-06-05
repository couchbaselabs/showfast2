package db

import (
	"fmt"

	"github.com/couchbase/gocb/v2"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// requiredIndex describes a single index the application depends on.
type requiredIndex struct {
	keyspace string // keyspace: `bucket`.`scope`.`collection`
	name     string
	fields   string // raw field list, e.g. "hidden, metric, runId"
}

// The primary query in GetTimelinePanels scans `benchmarks` and then does KV
// lookups into `runs`, `metrics`, and `clusters` via ON KEYS. The scan on
// benchmarks drives overall latency — indexes on the WHERE-clause fields allow
// Couchbase to use an index seek instead of a full collection scan.
var requiredIndexes = []requiredIndex{
	{
		// GetTimelinePanels now drives from metrics → benchmarks via ON KEY b.metric FOR m.
		// This index lets Couchbase find all benchmarks for a given metric ID efficiently.
		// Combined with the hidden field, the index also covers the b.hidden = False filter.
		keyspace: benchmarksKeyspace,
		name:     "idx_benchmarks_metric_hidden",
		fields:   "metric, hidden",
	},
	{
		// Covers: WHERE r.status = 'completed' (applied after KV join into runs)
		keyspace: runsKeyspace,
		name:     "idx_runs_status",
		fields:   "status",
	},
	{
		// Covers: WHERE m.hidden = False (primary scan when driving from metrics)
		keyspace: metricsKeyspace,
		name:     "idx_metrics_hidden",
		fields:   "hidden",
	},
	{
		// Covers: WHERE m.hidden = False AND m.component IN [...] AND m.category IN [...]
		// Used by GetTimelinePanels (driving collection) and GenericFiltering.
		keyspace: metricsKeyspace,
		name:     "idx_metrics_hidden_filters",
		fields:   "hidden, component, category, subCategory",
	},
}

// EnsureIndexes creates required indexes if they do not already exist.
// IF NOT EXISTS makes this idempotent — safe to call on every startup.
func (ds *DataStore) EnsureIndexes() {
	for _, idx := range requiredIndexes {
		stmt := fmt.Sprintf(
			"CREATE INDEX IF NOT EXISTS `%s` ON %s(%s)",
			idx.name, idx.keyspace, idx.fields,
		)
		_, err := ds.cluster.Query(stmt, &gocb.QueryOptions{})
		if err != nil {
			log.DefaultLogger.Warn("failed to ensure index",
				"index", idx.name,
				"err", err,
			)
		} else {
			log.DefaultLogger.Info("index ready", "index", idx.name)
		}
	}
}
