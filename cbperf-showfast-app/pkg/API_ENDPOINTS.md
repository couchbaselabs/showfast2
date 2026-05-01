# Showfast Backend API

Base path:
- `/api/plugins/cbperf-showfast-app/resources`

This document reflects the currently registered routes in `pkg/api/router.go` and how query parsing is implemented in `pkg/api/handlers.go` and `pkg/api/filter_handlers.go`.

## GET Endpoints

### GET /builds
Purpose:
- Returns distinct non-hidden build versions from benchmark documents.

Response:
- `200 OK` with `[]string`.

Errors:
- `500 Internal Server Error` on query failures.

### GET /metrics
Purpose:
- Returns metric documents filtered by optional components and dynamic tags.

Supported query params:
- `component=<value>`: optional, supports repeated and comma-separated values.
- `tag.<key>=<value>`: optional dynamic tag filters.
  - each tag key supports repeated and comma-separated values.

Examples:
- `/metrics?component=kv&component=n1ql`
- `/metrics?component=kv,n1ql`
- `/metrics?component=kv&tag.durability=none,majority`

Response:
- `200 OK` with `[]Metric`.

Errors:
- `500 Internal Server Error` on query failures.

### GET /benchmarks
Purpose:
- Returns benchmark documents filtered by optional components and dynamic tags.

Supported query params:
- `component=<value>`: optional, supports repeated and comma-separated values.
- `tag.<key>=<value>`: optional dynamic tag filters.
  - each tag key supports repeated and comma-separated values.

Examples:
- `/benchmarks?component=kv&component=n1ql`
- `/benchmarks?component=kv,n1ql&tag.resident_ratio=90,100`

Response:
- `200 OK` with `[]Benchmark`.

Errors:
- `500 Internal Server Error` on query failures.

### GET /timeline
Purpose:
- Returns timeline points for a metric as `[build, value]` pairs.

Required query params:
- `metric_id=<string>`

Response:
- `200 OK` with `[][]interface{}`.

Validation:
- `400 Bad Request` when `metric_id` is missing.

Errors:
- `500 Internal Server Error` on query failures.

### GET /runs
Purpose:
- Returns all run documents for a metric/build pair.

Required query params:
- `metric_id=<string>`
- `build=<string>`

Response:
- `200 OK` with `[]Run`.

Validation:
- `400 Bad Request` when required params are missing.

Errors:
- `500 Internal Server Error` on query failures.

### GET /filters
Purpose:
- Returns dynamic tag options derived from metrics.

Response:
- `200 OK` with `map[string][]string`.
  - key: tag key
  - value: distinct values for that tag key

Errors:
- `500 Internal Server Error` on query failures.

## GET /utils Endpoints

All `/utils/*` endpoints support repeated and comma-separated query values via shared `queryValues` parsing.

### GET /utils/components
Purpose:
- Returns distinct component values, filtered by optional category/subcategory/cluster/os constraints.

Supported query params:
- `category`, `subcategory`, `cluster`, `os`

### GET /utils/categories
Purpose:
- Returns distinct category values, filtered by optional component/subcategory/cluster/os constraints.

Supported query params:
- `component`, `subcategory`, `cluster`, `os`

### GET /utils/subcategories
Purpose:
- Returns distinct subCategory values, filtered by optional component/category/cluster/os constraints.

Supported query params:
- `component`, `category`, `cluster`, `os`

### GET /utils/clusters
Purpose:
- Returns distinct cluster names with optional filtering.

Supported query params:
- `component`, `category`, `subcategory`, `os`

### GET /utils/os
Purpose:
- Returns distinct OS values with optional filtering.

Supported query params:
- `component`, `category`, `subcategory`, `cluster`

Response for all `/utils/*`:
- `200 OK` with `[]string`.

Errors for all `/utils/*`:
- `500 Internal Server Error` with `{ "error": "..." }`.

## POST Endpoints

### POST /metrics
Purpose:
- Upserts a metric document by metric id.

Request body:
- JSON matching `Metric`.

Response:
- `201 Created` with `{ "id": "<metric-id>" }`.

Validation:
- `400 Bad Request` on JSON binding errors.

Errors:
- `500 Internal Server Error` on persistence failures.

### POST /clusters
Purpose:
- Upserts a cluster document by cluster name.

Request body:
- JSON matching `Cluster`.

Response:
- `201 Created` with `{ "name": "<cluster-name>" }`.

Validation:
- `400 Bad Request` on JSON binding errors.

Errors:
- `500 Internal Server Error` on persistence failures.

### POST /benchmarks
Purpose:
- Inserts a benchmark document and handles existing metric/build visibility logic in storage layer.

Request body:
- JSON matching `Benchmark`.

Response:
- `201 Created` with `{ "id": "<benchmark-id>" }`.

Validation:
- `400 Bad Request` on JSON binding errors.

Errors:
- `500 Internal Server Error` on persistence failures.

## PATCH Endpoints

### PATCH /benchmarks
Purpose:
- Toggles benchmark hidden state by id.

Required query params:
- `id=<string>`

Response:
- `200 OK` with `{ "status": "updated" }`.

Validation:
- `400 Bad Request` when `id` is missing.

Errors:
- `500 Internal Server Error` on update failures.

## DELETE Endpoints

### DELETE /benchmarks
Purpose:
- Deletes a benchmark by id.

Required query params:
- `id=<string>`

Response:
- `200 OK` with `{ "status": "deleted" }`.

Validation:
- `400 Bad Request` when `id` is missing.

Errors:
- `500 Internal Server Error` on delete failures.

## Query String Conventions

### Array-valued filters
- For `component`, `category`, `subcategory`, `cluster`, `os`, and dynamic `tag.<key>` values:
  - repeated form is supported: `?component=kv&component=n1ql`
  - comma-separated form is supported: `?component=kv,n1ql`
  - quoted values are normalized by the parser.

### Dynamic tags
- Any key prefixed by `tag.` is interpreted as a tag filter.
- Examples:
  - `/metrics?tag.durability=none,majority`
  - `/benchmarks?component=kv&tag.resident_ratio=90&tag.resident_ratio=100`

### Administrative benchmark actions
- Patch and delete use query-string id:
  - `/benchmarks?id=<benchmark-id>`
