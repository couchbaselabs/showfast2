import { getBackendSrv } from '@grafana/runtime';
import { API_BASE_URL } from '../../constants';

export interface RunVersions {
  sdk?: string | null;
  tls?: string | null;
  capella?: string | null;
  aiGateway?: string | null;
}

export interface RunDetailBenchmark {
  runId: string;
  value: number;
  build: string;
  os: string;
  dateTime: string;
  pipelineGroup: string;
  hidden: boolean;
  snapshots: string[];
}

export interface RunSummary {
  runId: string;
  value: number;
  dateTime: string;
  attempt: number;
  buildUrl: string;
  snapshots: string[];
  versions: RunVersions;
  hidden: boolean;
}

export interface RunDetailMetric {
  title: string;
  component: string;
  category: string;
  subCategory: string;
  chirality: number | null;
  memquota: number;
  provider: string;
}

export interface RunDetailRun {
  buildUrl: string;
  dateTime: string;
  attempt: number;
  versions: RunVersions;
}

export interface RunDetailTest {
  title: string;
  testConfig: string;
  threshold: number | null;
  tags: Record<string, unknown>;
}

export interface RunDetailCluster {
  name: string;
  os: string;
  cpu: string;
  memory: string;
  disk: string;
  provider: string;
}

export interface RunDetailBuild {
  version: string;
  majorMinor: string;
  buildType: string;
}

export interface RunDetail {
  benchmark: RunDetailBenchmark;
  metric: RunDetailMetric;
  run: RunDetailRun;
  test: RunDetailTest;
  cluster: RunDetailCluster;
  build: RunDetailBuild;
  reruns: RunSummary[];
}

export async function fetchRunDetail(runId: string, metricId: string): Promise<RunDetail> {
  const params = new URLSearchParams({ runId, metricId });
  return getBackendSrv().get<RunDetail>(`${API_BASE_URL}/runs/detail?${params.toString()}`);
}

export function formatSnapshotUrl(snapshotId: string): string {
  if (snapshotId.includes('_')) {
    return `http://cbmonitor.sc.couchbase.com/reports/html/?snapshot=${encodeURIComponent(snapshotId)}`;
  }
  return `https://cbmonitor2.sc.couchbase.com/a/cbmonitor/snapshots/${encodeURIComponent(snapshotId)}`;
}

export function formatDetailDate(iso: string): string {
  if (!iso) {
    return '';
  }
  try {
    const d = new Date(iso);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
  } catch {
    return iso;
  }
}
