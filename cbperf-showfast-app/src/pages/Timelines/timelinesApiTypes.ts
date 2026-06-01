/**
 * Shared API contracts for Timelines page data.
 * Keep frontend modules aligned with backend payloads.
 */

export interface TimelinePoint {
  build: string;
  value: number;
  buildUrl?: string;
  snapshots?: string[];
}

export interface TimelineClusterInfo {
  name: string;
  os: string;
  cpu: string;
  disk: string;
  memory: string;
}

export interface TimelinePanel {
  metricId: string;
  title: string;
  category: string;
  subCategory: string;
  component: string;
  cluster: string;
  clusterInfo?: TimelineClusterInfo;
  tags?: Record<string, string>;
  benchmarksValues: TimelinePoint[];
}

export interface TimelinePanelsQuery {
  serverMajorMinor?: string[];
  pipelineGroup?: string[];
  os?: string[];
  component?: string[];
  category?: string[];
  subcategory?: string[];
  cluster?: string[];
  tags?: Record<string, string[]>;
}
