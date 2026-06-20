export interface ComponentStatus {
  component: string;
  total: number;
  passed: number;
  warning: number;
  regressed: number;
  neutral: number;
}

export interface PipelineSummary {
  build: string;
  type: string;
  date: string;
  components: ComponentStatus[];
}

export interface PipelineSummaryResponse {
  pipelines: PipelineSummary[];
}

export interface JenkinsRun {
  test_config: string;
  cluster: string;
  version: string;
  component: string;
  duration: number;
  job: string;
  success: boolean;
  timestamp: number;
  url: string;
}

export interface JenkinsRunsResponse {
  runs: JenkinsRun[];
}
