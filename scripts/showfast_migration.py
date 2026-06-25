#!/usr/bin/env python3
r"""
Showfast data-model migration (exploratory).

Transforms the legacy flat ShowFast data (three buckets: `benchmarks`,
`metrics`, `clusters`) into the new six-collection model that lives in the
`showfast.showfast` scope: `tests`, `clusters`, `builds`, `runs`, `metrics`,
`benchmarks`.

This is a re-runnable exploration tool, not a one-shot prod job: load a slice,
inspect it, tweak the model, re-run. Idempotent upserts (stable doc keys) mean
re-running overwrites rather than duplicates.

Run from the repo root (so `perfrunner.settings` imports and tests/ clusters/
globs resolve):

    env/bin/python migrate.py [options]

Common invocations
------------------
    # Print the six derived docs for benchmarks of one metric, write nothing:
    env/bin/python migrate.py --dry-run --limit 20 --metric <metric-id>

    # Load a small slice for one cluster:
    env/bin/python migrate.py --cluster triton_kv --limit 500

    # Clean reload during tuning (clears only the six dest collections, never
    # the bucket / the management scope), then full load:
    env/bin/python migrate.py --flush

Options
-------
    --host           Couchbase host        (default localhost:3000 / $CB_HOST)
    --username       (default Administrator / $CB_USER)
    --password       (default password      / $CB_PASS)
    --dest-bucket    (default showfast)
    --dest-scope     (default showfast)
    --limit N        cap number of source benchmarks processed
    --metric ID      only benchmarks whose `metric` == ID
    --cluster NAME   only benchmarks whose resolved cluster == NAME
    --flush          DELETE all docs in the six dest collections before loading
    --dry-run        print sample docs, write nothing
    --batch-size N   upsert batch size (default 1000)

Model-tuning knobs / open items
-------------------------------
  * metricGroup: derived by stripping a trailing percentile token
    (_p\\d+ | _\\d+th | _percentile_\\d+). statGroup is empty in all source
    metrics, so it can't be reused. Adjust PERCENTILE_RE to retune grouping.
  * build docs: legacy data dropped the "-enterprise" suffix at write time, so
    buildType defaults to "enterprise" unless a token says otherwise.
  * metric/test ids keep the legacy cluster suffix verbatim; only the `cluster`
    FK on metric is rewritten to the new cluster doc id.

Observed on the real data (May 2026)
------------------------------------
  * Run identity is the Jenkins build: runs are grouped by (buildURL, cluster),
    falling back to (build, dateTime, cluster) when buildURL is missing. The test
    name is deliberately NOT part of the key because metric ids embed a per-metric
    descriptor (e.g. ..._ssl_deploy / ..._ssl_pause), which would split siblings.
    Verified: e.g. phase_change_time100M_bktop_ssl_{deploy,pause,resume} collapse
    to one run.
  * Orphans: a sizeable fraction of legacy benchmarks reference a `metric` doc that
    no longer exists in the `metrics` bucket (renamed/deleted over the years). These
    can't be resolved to a cluster/test and are skipped + counted, not written.
  * testConfig is often null: when a metric id carries a descriptor, the recovered
    test name won't match a tests/**/*.test basename, so the test doc is minimal.
"""

import argparse
import glob
import hashlib
import json
import os
import queue
import re
import sys
import threading
from collections import defaultdict
from functools import lru_cache

from couchbase.auth import PasswordAuthenticator
from couchbase.cluster import Cluster
from couchbase.options import ClusterOptions

# Repo imports (script is run from repo root).
from perfrunner.settings import ClusterSpec, TestConfig

DEST_COLLECTIONS = ["tests", "clusters", "builds", "runs", "metrics", "benchmarks"]

SERVER_RE = re.compile(r"^\d+\.\d+\.\d+-\d+$")
TLS_RE = re.compile(r"^tlsv?[\d.]+$", re.IGNORECASE)
PERCENTILE_RE = re.compile(r"(_p\d+|_\d+th|_percentile_\d+)$")


# --------------------------------------------------------------------------- #
# Connection
# --------------------------------------------------------------------------- #
def connect(host, username, password):
    from datetime import timedelta

    from couchbase.options import ClusterTimeoutOptions

    options = ClusterOptions(
        PasswordAuthenticator(username, password),
        timeout_options=ClusterTimeoutOptions(
            connect_timeout=timedelta(seconds=30),
            kv_timeout=timedelta(seconds=30),
            query_timeout=timedelta(seconds=120),
        ),
    )
    # The SDK bootstrap to this on-prem cluster is occasionally flaky; retry.
    last_exc = None
    for attempt in range(1, 4):
        try:
            cluster = Cluster(f"couchbase://{host}", options)
            cluster.wait_until_ready(timedelta(seconds=60))
            return cluster
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            print(f"Connect attempt {attempt}/3 failed: {exc}")
    raise last_exc


def query_all(cluster, statement, **named):
    """Run a N1QL query and return all rows as dicts."""
    from couchbase.options import QueryOptions

    rows = cluster.query(statement, QueryOptions(named_parameters=named))
    return list(rows)


# --------------------------------------------------------------------------- #
# Slug / parsing helpers
# --------------------------------------------------------------------------- #
def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")


def parse_os(os_string):
    """'Ubuntu 24.04' -> ({distro, version, kernel}, 'ubuntu-24.04')."""
    os_string = (os_string or "").strip()
    if not os_string:
        return {"distro": None, "version": None, "kernel": None}, "unknown"
    m = re.search(r"([\d.]+)\s*$", os_string)
    version = m.group(1) if m else None
    distro = os_string[: m.start()].strip() if m else os_string
    return (
        {"distro": distro or None, "version": version, "kernel": None},
        slugify(os_string),
    )


@lru_cache(maxsize=8192)
def _parse_build_cached(build_str):
    """Best-effort split of the colon-concatenated build string.

    Returns (server_version, versions_dict). server_version may be None.
    The full original string is preserved by callers as the human label.
    """
    versions = {"sdk": None, "tls": None, "sgw": None, "capella": None, "aiGateway": None}
    server = None
    # Normalise: a few legacy strings glue the trailing token with ':' and no
    # spaces (e.g. '7.1.0-1985:disabled').
    tokens = [t.strip() for t in re.split(r"\s*:\s*", build_str or "") if t.strip()]
    server_idx = None
    for i, tok in enumerate(tokens):
        if SERVER_RE.match(tok):
            server = tok
            server_idx = i
            break
    for i, tok in enumerate(tokens):
        if i == server_idx:
            continue
        if TLS_RE.match(tok):
            # 'tlsv1.3' -> '1.3', 'tlsv1' -> '1'
            versions["tls"] = re.sub(r"^tlsv?", "", tok, flags=re.IGNORECASE) or None
        elif server_idx is not None and i > server_idx:
            # token after the server build -> Capella control-plane version
            versions["capella"] = tok
        else:
            # leading non-tls, non-server token -> treat as SDK/connector version
            versions["sdk"] = tok
    return (
        server,
        versions["sdk"],
        versions["tls"],
        versions["sgw"],
        versions["capella"],
        versions["aiGateway"],
    )


def parse_build(build_str):
    server, sdk, tls, sgw, capella, ai_gateway = _parse_build_cached(build_str or "")
    return server, {
        "sdk": sdk,
        "tls": tls,
        "sgw": sgw,
        "capella": capella,
        "aiGateway": ai_gateway,
    }


@lru_cache(maxsize=4096)
def major_minor(version):
    if not version:
        return None
    m = re.match(r"(\d+\.\d+)", version)
    return m.group(1) if m else None


@lru_cache(maxsize=65536)
def to_iso(date_time):
    """'2024-03-30 03:10' -> '2024-03-30T03:10:00Z' (best effort)."""
    if not date_time:
        return None
    dt = date_time.strip().replace(" ", "T")
    if re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$", dt):
        dt += ":00"
    if not dt.endswith("Z"):
        dt += "Z"
    return dt


# --------------------------------------------------------------------------- #
# Repo metadata: .test resolution and pipeline groups
# --------------------------------------------------------------------------- #
def build_test_index():
    """Basename (no extension) -> full .test path. On collision keep shortest path."""
    index = {}
    for path in glob.glob("tests/**/*.test", recursive=True):
        name = os.path.splitext(os.path.basename(path))[0]
        if name not in index or len(path) < len(index[name]):
            index[name] = path
    return index


def build_pipeline_groups():
    """Basename (no extension) -> pipeline group, from tests/pipelines/*.json.

    Rules, in descending priority (a test can appear in several pipelines):
      * any test in a daily-*.json pipeline        -> 'daily'
      * any test in a syncgateway-*.json pipeline   -> 'p0'
      * otherwise                                   -> the job's `groups` value
        (e.g. 'P0'/'P1' on the weekly/capella/columnar pipelines).

    All group values are normalised to lower case ('p0', 'p1', 'daily', ...).

    The sgw pipelines reference the test under a `test` key; the others use
    `test_config`.
    """
    daily, sgw, other = {}, {}, {}
    for pipeline in glob.glob("tests/pipelines/*.json"):
        base = os.path.basename(pipeline)
        try:
            with open(pipeline) as fh:
                data = json.load(fh)
        except (ValueError, OSError):
            continue
        if base.startswith("daily-"):
            target, forced = daily, "daily"
        elif base.startswith("syncgateway-"):
            target, forced = sgw, "p0"
        else:
            target, forced = other, None
        for _component, jobs in data.items():
            if not isinstance(jobs, list):
                continue
            for job in jobs:
                tc = job.get("test_config") or job.get("test")
                if not tc:
                    continue
                grp = forced or job.get("groups")
                if not grp:
                    continue
                name = os.path.splitext(os.path.basename(tc))[0]
                target.setdefault(name, grp.lower())
    # Precedence: daily wins over sgw wins over the per-pipeline groups value.
    groups = dict(other)
    groups.update(sgw)
    groups.update(daily)
    return groups


def make_test_doc(test_name, test_index, fallback_title):
    """Parse the .test file via TestConfig when present; else a minimal doc."""
    path = test_index.get(test_name)
    doc = {
        "id": f"test:{slugify(path) if path else slugify(test_name)}",
        "testConfig": path,
        "tags": {},
        "threshold": None,
        "orderBy": "",
    }

    if not path:
        doc["title"] = fallback_title
        return doc
    try:
        tc = TestConfig()
        tc.parse(path)
        doc["tags"]["storageBackend"] = tc.bucket.backend_storage
        doc["tags"]["buckets"] = tc.cluster.num_buckets
        doc["tags"]["vbuckets"] = tc.cluster.num_vbuckets
        doc["threshold"] = tc.showfast.threshold
        doc["orderBy"] = tc.showfast.order_by
        doc["title"] = tc.showfast.title or fallback_title
    except Exception as exc:
        doc["title"] = fallback_title
        doc["parseError"] = str(exc)
    return doc


def cluster_provider(cluster_name):
    """Best-effort provider from clusters/<name>.spec, else None."""
    path = f"clusters/{cluster_name}.spec"
    if not os.path.isfile(path):
        return None
    try:
        spec = ClusterSpec()
        spec.parse(path)
        if spec.cloud_infrastructure:
            return spec.cloud_provider
        return "onprem"
    except Exception:  # noqa: BLE001
        return None


# --------------------------------------------------------------------------- #
# Doc builders
# --------------------------------------------------------------------------- #
def _cval(raw, *keys):
    """Case-insensitive field lookup (cluster docs mix 'OS'/'os', 'CPU'/'cpu', ...)."""
    for key in keys:
        for variant in (key, key.upper(), key.lower(), key.capitalize()):
            if variant in raw and raw[variant] not in (None, ""):
                return raw[variant]
    return None


def make_cluster_doc(name, raw):
    os_obj, os_slug = parse_os(_cval(raw, "OS"))
    doc_id = f"cluster:{name}:{os_slug}"
    return doc_id, os_slug, {
        "id": doc_id,
        "name": name,
        "os": os_obj,
        "cpu": _cval(raw, "CPU"),
        "memory": _cval(raw, "Memory"),
        "disk": _cval(raw, "Disk"),
        "provider": cluster_provider(name),
    }


def make_build_doc(server_version, raw_version):
    return f"build:server:{server_version}", {
        "id": f"build:server:{server_version}",
        "component": "server",
        "version": server_version,
        "majorMinor": major_minor(server_version),
        "buildType": "enterprise",
        "rawVersion": raw_version,
    }


def make_metric_doc(raw, cluster_id):
    metric_id = raw["id"]
    group = PERCENTILE_RE.sub("", metric_id) if PERCENTILE_RE.search(metric_id) else None
    doc = dict(raw)
    doc.pop("_k", None)
    doc["type"] = "metric"
    doc["metricGroup"] = group
    doc["cluster"] = cluster_id
    return metric_id, doc


# --------------------------------------------------------------------------- #
# Writer
# --------------------------------------------------------------------------- #
class Writer:
    def __init__(self, scope, dry_run, batch_size):
        self.scope = scope
        self.dry_run = dry_run
        self.batch_size = batch_size
        self.buffers = defaultdict(dict)  # collection -> {key: doc}
        self.counts = defaultdict(int)

    def put(self, collection, key, doc):
        self.counts[collection] += 1
        if self.dry_run:
            if self.counts[collection] <= 3:
                print(f"\n--- {collection} / {key} ---")
                print(json.dumps(doc, indent=2, default=str))
            return
        buf = self.buffers[collection]
        buf[key] = doc
        if len(buf) >= self.batch_size:
            self._flush_collection(collection)

    def _flush_collection(self, collection):
        buf = self.buffers[collection]
        if not buf:
            return
        coll = self.scope.collection(collection)
        # Bulk upsert is significantly faster than one KV op per document.
        coll.upsert_multi(buf)
        buf.clear()

    def flush(self):
        for collection in list(self.buffers):
            self._flush_collection(collection)


def flush_destination(cluster, bucket_name, scope_name):
    for collection in DEST_COLLECTIONS:
        stmt = f"DELETE FROM `{bucket_name}`.`{scope_name}`.`{collection}`"
        print(f"Flushing {bucket_name}.{scope_name}.{collection}")
        list(cluster.query(stmt))


def make_run_id(build_url, build, date_time, cluster_name):
    if build_url:
        run_identity = f"url|{build_url}|{cluster_name or ''}"
    else:
        run_identity = f"fallback|{build or ''}|{date_time or ''}|{cluster_name or ''}"
    return f"run:{hashlib.sha1(run_identity.encode('utf-8')).hexdigest()}"


# --------------------------------------------------------------------------- #
# Main migration
# --------------------------------------------------------------------------- #
def migrate(args):
    cluster = connect(args.host, args.username, args.password)
    dest_scope = cluster.bucket(args.dest_bucket).scope(args.dest_scope)
    writer = Writer(dest_scope, args.dry_run, args.batch_size)

    if args.flush and not args.dry_run:
        flush_destination(cluster, args.dest_bucket, args.dest_scope)

    print("Loading reference data (metrics, clusters) ...")
    metrics_by_id = {r["id"]: {k: v for k, v in r.items() if k != "_k"}
                     for r in query_all(cluster, "SELECT META().id AS _k, m.* FROM metrics AS m")}
    clusters_by_name = {}
    for r in query_all(cluster, "SELECT META().id AS _k, c.* FROM clusters AS c"):
        name = r.get("Name") or r.get("name")
        if not name:
            continue
        # Prefer the richest record on duplicate names.
        if name not in clusters_by_name or len(r) > len(clusters_by_name[name]):
            clusters_by_name[name] = r
    print(f"  {len(metrics_by_id)} metrics, {len(clusters_by_name)} clusters")

    test_index = build_test_index()
    pipeline_groups = build_pipeline_groups()
    print(f"  {len(test_index)} .test files, {len(pipeline_groups)} tests with pipeline groups")

    # Caches so each reference doc is emitted once.
    cluster_id_cache = {}   # cluster name -> (cluster_id, os_slug)
    emitted_clusters = set()
    emitted_builds = set()
    emitted_tests = set()
    emitted_metrics = set()
    emitted_runs = set()

    def resolve_cluster(name):
        if name in cluster_id_cache:
            return cluster_id_cache[name]
        raw = clusters_by_name.get(name)
        if raw is None:
            cluster_id_cache[name] = (None, "unknown")
            return cluster_id_cache[name]
        cluster_id, os_slug, doc = make_cluster_doc(name, raw)
        if cluster_id not in emitted_clusters:
            writer.put("clusters", cluster_id, doc)
            emitted_clusters.add(cluster_id)
        cluster_id_cache[name] = (cluster_id, os_slug)
        return cluster_id_cache[name]

    def test_name_from_metric(metric_id, cluster_name):
        suffix = "_" + cluster_name
        if cluster_name and metric_id.endswith(suffix):
            return metric_id[: -len(suffix)]
        return metric_id

    # Stream benchmarks with keyset pagination on META().id.
    print("Streaming benchmarks ...")
    where = []
    if args.metric:
        where.append("b.metric = $metric")
    if where:
        clause = " AND " + " AND ".join(where)
    else:
        clause = ""

    processed = 0
    orphans = 0
    page = args.batch_size

    row_queue = queue.Queue(maxsize=4)
    sentinel = object()
    stop_event = threading.Event()
    producer_error = []

    def process_row(row):
        nonlocal processed, orphans
        metric_id = row.get("metric")
        metric_raw = metrics_by_id.get(metric_id)
        if metric_raw is None:
            orphans += 1
            return
        cluster_name = metric_raw.get("cluster")
        if args.cluster and cluster_name != args.cluster:
            return

        processed += 1
        cluster_id, os_slug = resolve_cluster(cluster_name)
        test_name = test_name_from_metric(metric_id, cluster_name)

        # test doc (once)
        if test_name not in emitted_tests:
            tdoc = make_test_doc(test_name, test_index, metric_raw.get("title"))
            writer.put("tests", tdoc["id"], tdoc)
            emitted_tests.add(test_name)

        test_id_value = test_index[test_name] if test_name in test_index else test_name
        test_id = f"test:{slugify(test_id_value)}"

        # metric doc (once)
        if metric_id not in emitted_metrics:
            _, mdoc = make_metric_doc(metric_raw, cluster_id)
            writer.put("metrics", metric_id, mdoc)
            emitted_metrics.add(metric_id)

        # build doc (once per server version)
        server_version, versions = parse_build(row.get("build"))
        server_build_id = None
        if server_version:
            server_build_id = f"build:server:{server_version}"
            if server_version not in emitted_builds:
                _, bdoc = make_build_doc(server_version, row.get("build"))
                writer.put("builds", server_build_id, bdoc)
                emitted_builds.add(server_version)

        pipeline_group = pipeline_groups.get(test_name)

        # run doc (grouped: sibling KPIs of one invocation share a run).
        # A run == one Jenkins build (perfrunner invocation) on one cluster, so
        # we key on buildURL (+ cluster as a safety tiebreak). We deliberately do
        # NOT key on the test name: metric ids embed a per-metric descriptor
        # (e.g. ..._avg_query_requests), so the recovered name differs between
        # sibling metrics of the same run and would wrongly split the group.
        build_url = row.get("buildURL")
        run_id = make_run_id(build_url, row.get("build"), row.get("dateTime"), cluster_name)
        if run_id not in emitted_runs:
            emitted_runs.add(run_id)
            writer.put("runs", run_id, {
                "id": run_id,
                "attempt": 1,
                "status": "completed",
                "dateTime": to_iso(row.get("dateTime")),
                "buildURL": build_url,
                "pipelineGroup": pipeline_group,
                "testId": test_id,
                "clusterId": cluster_id,
                "serverBuildId": server_build_id,
                "versions": versions,
            })

        # benchmark doc (reuse legacy uhex id)
        bench_id = row.get("id") or row["_k"]
        writer.put("benchmarks", bench_id, {
            "id": bench_id,
            "runId": run_id,
            "metric": metric_id,
            "value": row.get("value"),
            "snapshots": row.get("snapshots", []),
            "hidden": row.get("hidden", False),
            "serverMajorMinor": major_minor(server_version),
            "pipelineGroup": pipeline_group,
            "os": os_slug,
            "dateTime": to_iso(row.get("dateTime")),
            "build": row.get("build"),
        })

    def producer():
        last_key = ""
        try:
            while not stop_event.is_set():
                stmt = (
                    "SELECT META().id AS _k, b.* FROM benchmarks AS b "
                    f"WHERE META().id > $last{clause} ORDER BY META().id LIMIT $page"
                )
                params = {"last": last_key, "page": page}
                if args.metric:
                    params["metric"] = args.metric
                rows = query_all(cluster, stmt, **params)
                if not rows:
                    break
                last_key = rows[-1]["_k"]
                while not stop_event.is_set():
                    try:
                        row_queue.put(rows, timeout=0.5)
                        break
                    except queue.Full:
                        continue
        except Exception as exc:  # noqa: BLE001
            producer_error.append(exc)
            stop_event.set()
        finally:
            while not stop_event.is_set():
                try:
                    row_queue.put(sentinel, timeout=0.5)
                    break
                except queue.Full:
                    continue

    producer_thread = threading.Thread(target=producer, name="benchmark-producer", daemon=True)
    producer_thread.start()

    try:
        while True:
            if producer_error:
                raise producer_error[0]
            try:
                rows = row_queue.get(timeout=0.5)
            except queue.Empty:
                if not producer_thread.is_alive() and row_queue.empty():
                    break
                continue

            if rows is sentinel:
                break

            for row in rows:
                if args.limit and processed >= args.limit:
                    stop_event.set()
                    break
                process_row(row)

            if processed % (page * 10) < page:
                run_count = len(emitted_runs)
                print(f"  processed {processed} benchmarks ({run_count} runs, {orphans} orphans)...")

            if args.limit and processed >= args.limit:
                break
    finally:
        stop_event.set()
        producer_thread.join()

    if producer_error:
        raise producer_error[0]

    writer.flush()
    print(f"\nDone. Processed {processed} benchmarks, {orphans} orphans (metric not found).")
    print("Emitted docs:")
    for collection in DEST_COLLECTIONS:
        print(f"  {collection:<11} {writer.counts.get(collection, 0)}")


def parse_args(argv):
    p = argparse.ArgumentParser(description="ShowFast legacy -> new data-model migration")
    p.add_argument("--host", default=os.getenv("CB_HOST", "localhost:3000"))
    p.add_argument("--username", default=os.getenv("CB_USER", "Administrator"))
    p.add_argument("--password", default=os.getenv("CB_PASS", "password"))
    p.add_argument("--dest-bucket", default="showfast")
    p.add_argument("--dest-scope", default="showfast")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--metric", default=None)
    p.add_argument("--cluster", default=None)
    p.add_argument("--flush", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--batch-size", type=int, default=1000)
    return p.parse_args(argv)


if __name__ == "__main__":
    migrate(parse_args(sys.argv[1:]))
