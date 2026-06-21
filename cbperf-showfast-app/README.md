# cbperf-showfast-app

Grafana app plugin for visualising Couchbase performance benchmark results. Provides timeline charts, weekly build reports, and pipeline health summaries backed by a Go API server and Couchbase Server.

---

## API Reference

All endpoints are served by the Go backend and proxied through Grafana at `/api/plugins/cbperf-showfast-app/resources`.

### Weekly Reports

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/summary/generate-weekly` | (Re)generate precomputed weekly reports |
| `GET` | `/weekly/builds` | List of all weekly pipeline builds |
| `GET` | `/weekly/detail` | Full per-component metric detail for a build |

**`POST /summary/generate-weekly`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `build` | no | Regenerate only this build. Omit to regenerate all active builds. |

Writes two doc types per build into `showfast.management.weekly`:
- `weekly::<build>` - summary counts per component
- `weekly-detail::<build>::<component>` - full metric list per component

Tickets are read live from `management.pipelines` at query time (not stored in the weekly docs).

Example - trigger at the end of a pipeline run for build `8.0.0-1234`:
```bash
curl -X POST "http://grafana-host/api/plugins/cbperf-showfast-app/resources/summary/generate-weekly?build=8.0.0-1234"
```


**`GET /weekly/detail`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `build` | yes | Build string e.g. `8.0.0-1234` |

Returns component-level metric results (value, baseline, status, tickets) for the given build. Reads from precomputed KV docs when available; falls back to live queries computation.

---
### Timelines

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/timelines/panels` | All timeline panels, optionally paginated |
| `GET` | `/timelines/panel/:metricId` | Single metric timeline panel |
| `GET` | `/timeline/:metricId` | Raw time-series data for one metric |

**Query parameters for `/timelines/panels` and `/timelines/panel/:metricId`:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `component` | string (multi) | Filter by component name(s) |
| `category` | string (multi) | Filter by category |
| `subcategory` | string (multi) | Filter by sub-category |
| `cluster` | string (multi) | Filter by cluster name |
| `serverMajorMinor` | string (multi) | Filter by server version e.g. `8.0` |
| `showHiddenMetrics` | `true` | Include hidden metrics |
| `showHiddenBenchmarks` | `true` | Include hidden benchmark runs |
| `limit` | integer | Page size (enables pagination response) |
| `offset` | integer | Page offset (used with `limit`) |

---

### Pipeline Summary (Home Page)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/summary/daily-component-status` | Pass/warn/regressed counts per component, last 24 h |
| `GET` | `/summary/weekly-component-status` | Pass/warn/regressed counts per component, last 7 days |
| `GET` | `/summary/jenkins-runs` | Recent Jenkins job executions |

**`GET /summary/jenkins-runs`**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `limit` | `100` | Max rows to return (capped at 200) |

---

### Benchmarks & Runs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/benchmarks` | List benchmarks |
| `GET` | `/runs` | Runs for a specific metric + build |
| `GET` | `/runs/detail` | Full detail for a single run |
| `GET` | `/builds` | All known build strings |
| `GET` | `/metrics` | All metrics |
| `POST` | `/benchmarks` | Record a new benchmark result |
| `POST` | `/runs` | Record a new run |
| `POST` | `/builds` | Register a new build |
| `POST` | `/metrics` | Register a new metric |
| `POST` | `/clusters` | Register a new cluster |
| `POST` | `/tests` | Register a new test |
| `PATCH` | `/benchmarks` | Toggle hidden flag on a benchmark (`?id=`) |
| `DELETE` | `/benchmarks` | Delete a benchmark (`?id=`) |

**`GET /runs`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `metric_id` | yes | Metric document ID |
| `build` | yes | Build string |

---

### Filters

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/filters` | All filter values (components, clusters, versions, …) |
| `GET` | `/filters/components` | Component list |
| `GET` | `/filters/categories` | Category list |
| `GET` | `/filters/subcategories` | Sub-category list |
| `GET` | `/filters/clusters` | Cluster list |
| `GET` | `/filters/os` | OS list |
| `GET` | `/filters/pipeline-groups` | Pipeline group list |
| `GET` | `/filters/server-major-minors` | Server major.minor list |
| `POST` | `/filters/reload` | Invalidate the in-memory filter cache |

---

### Menu / Navigation

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/menu/variants` | Navigation variant list |
| `GET` | `/menu/component/:id` | Component menu entry |
| `POST` | `/menu/reload` | Reload menu from disk |

---

### Cluster Info

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/cluster/:clusterId` | Hardware and config details for a cluster |

---

## Building

### Frontend

```bash
npm install
npm run build        # production build → dist/
npm run dev          # watch mode (development)
```

### Backend

```bash
mage -v              # builds Go binaries → dist/gpx_*
```

After a backend rebuild, **restart the Grafana server** so it loads the new binary.
