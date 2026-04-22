# Showfast Backend API (v2)

Base path: `/api/v2`

This document lists all currently registered endpoints in the backend and describes what each one does.

## GET Endpoints

### GET /builds
Purpose:
- Returns all build versions that have non-hidden benchmark data.

Typical response:
- `200 OK` with `[]string` of build names.

Error behavior:
- `500 Internal Server Error` if build query fails.

### GET /metrics
Purpose:
- Returns metric definitions filtered by optional query params.

Supported query params:
- `component=<string>` optional component filter.
- `tag.<key>=<value>` optional dynamic tag filters; can be repeated for multiple tags.

Notes:
- Tag keys are interpreted from query params prefixed with `tag.`.
- All provided tag filters are combined as intersection filters.

Typical response:
- `200 OK` with `[]Metric`.

Error behavior:
- `500 Internal Server Error` if metric query fails.

### GET /benchmarks
Purpose:
- Returns benchmark rows filtered by component and optional tag filters.

Supported query params:
- `component=<string>` component filter.
- `tag.<key>=<value>` optional dynamic tag filters; can be repeated.

Typical response:
- `200 OK` with `[]Benchmark`.

Error behavior:
- `500 Internal Server Error` if benchmark query fails.

### GET /timeline
Purpose:
- Returns historical benchmark values for a specific metric.

Required query params:
- `metric_id=<string>` metric identifier.

Typical response:
- `200 OK` with timeline data as `[][]interface{}`.

Validation:
- `400 Bad Request` if `metric_id` is missing.

Error behavior:
- `500 Internal Server Error` if timeline query fails.

### GET /runs
Purpose:
- Returns detailed run records for a specific metric/build combination.

Required query params:
- `metric_id=<string>` metric identifier.
- `build=<string>` build identifier.

Typical response:
- `200 OK` with `[]Run`.

Validation:
- `400 Bad Request` if `metric_id` or `build` is missing.

Error behavior:
- `500 Internal Server Error` if run query fails.

### GET /compare
Purpose:
- Compares benchmark values between two builds for a component (and optional tags).

Required query params:
- `build1=<string>` first build.
- `build2=<string>` second build.
- `component=<string>` component to compare.

Optional query params:
- `tag.<key>=<value>` optional tag filters.

Typical response:
- `200 OK` with a list of comparison objects:
  - `metric`: metric id
  - `build1`: value for build1 if present
  - `build2`: value for build2 if present
  - `delta`: `build2 - build1` when both values exist

Validation:
- `400 Bad Request` if `build1`, `build2`, or `component` is missing.

Error behavior:
- `500 Internal Server Error` if benchmark query fails.

### GET /filters
Purpose:
- Returns available UI filter values derived from metrics.

Typical response:
- `200 OK` with:
  - `components`: list of distinct component values
  - `tags`: map of tag key to distinct values

Error behavior:
- `500 Internal Server Error` if filter query fails.

## POST Endpoints

### POST /metrics
Purpose:
- Creates or updates a metric document (upsert by `metric.id`).

Request body:
- JSON object matching `Metric`.

Typical response:
- `201 Created` with `{ "id": "<metric-id>" }`.

Validation:
- `400 Bad Request` if JSON binding fails.

Error behavior:
- `500 Internal Server Error` if persistence fails.

### POST /clusters
Purpose:
- Creates or updates a cluster profile document (upsert by `cluster.name`).

Request body:
- JSON object matching `Cluster`.

Typical response:
- `201 Created` with `{ "name": "<cluster-name>" }`.

Validation:
- `400 Bad Request` if JSON binding fails.

Error behavior:
- `500 Internal Server Error` if persistence fails.

### POST /benchmarks
Purpose:
- Inserts a benchmark document.
- Before insert, existing non-hidden benchmarks with the same metric/build are marked hidden.

Request body:
- JSON object matching `Benchmark`.

Typical response:
- `201 Created` with `{ "id": "<benchmark-id>" }`.

Validation:
- `400 Bad Request` if JSON binding fails.

Error behavior:
- `500 Internal Server Error` if lookup/update/insert fails.

## PATCH Endpoints

### PATCH /benchmarks
Purpose:
- Toggles the `hidden` state for a benchmark.

Required query params:
- `id=<string>` benchmark document id.

Typical response:
- `200 OK` with `{ "status": "updated" }`.

Validation:
- `400 Bad Request` if `id` is missing.

Error behavior:
- `500 Internal Server Error` if lookup/update fails.

## DELETE Endpoints

### DELETE /benchmarks
Purpose:
- Deletes a benchmark by id.

Required query params:
- `id=<string>` benchmark document id.

Typical response:
- `200 OK` with `{ "status": "deleted" }`.

Validation:
- `400 Bad Request` if `id` is missing.

Error behavior:
- `500 Internal Server Error` if delete fails.

## Query String Conventions

### Dynamic tag filters
- Any query parameter starting with `tag.` is treated as a tag filter.
- Example:
  - `/api/v2/metrics?component=kv&tag.durability=majority&tag.resident_ratio=90`

### Administrative benchmark actions
- The current PATCH and DELETE benchmark endpoints use query-string id:
  - `/api/v2/benchmarks?id=<benchmark-id>`
