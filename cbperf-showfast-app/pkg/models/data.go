package models

type Benchmark struct {
	ID               string   `json:"id"`
	RunID            string   `json:"runId"`
	Metric           string   `json:"metric"`
	Value            float64  `json:"value"`
	Snapshots        []string `json:"snapshots,omitempty"`
	Hidden           bool     `json:"hidden"`
	ServerMajorMinor string   `json:"serverMajorMinor,omitempty"`
	PipelineGroup    string   `json:"pipelineGroup,omitempty"`
	OS               string   `json:"os,omitempty"`
	DateTime         string   `json:"dateTime,omitempty"`
	Build            string   `json:"build"`
}

type Cluster struct {
	ID     string      `json:"id,omitempty"`
	CPU    string      `json:"cpu"`
	Disk   string      `json:"disk"`
	Memory string      `json:"memory"`
	Name   string      `json:"name"`
	OS     interface{} `json:"os"`
}

type Metric struct {
	Cluster     string            `json:"cluster"`
	Category    string            `json:"category"`
	Component   string            `json:"component"`
	ID          string            `json:"id"`
	OrderBy     string            `json:"orderBy"`
	SubCategory string            `json:"subCategory"`
	Title       string            `json:"title"`
	Chirality   int               `json:"chirality"`
	MemQuota    int64             `json:"memQuota"`
	Provider    string            `json:"provider"`
	Hidden      bool              `json:"hidden"`
	MetricGroup string            `json:"metricGroup,omitempty"`
	Tags        map[string]string `json:"tags,omitempty"`
}

type Test struct {
	ID         string                 `json:"id"`
	TestConfig string                 `json:"testConfig"`
	Workload   map[string]interface{} `json:"workload,omitempty"`
	Tags       map[string]interface{} `json:"tags,omitempty"`
	Threshold  *float64               `json:"threshold,omitempty"`
	OrderBy    string                 `json:"orderBy,omitempty"`
}

type Build struct {
	ID         string `json:"id"`
	Component  string `json:"component"`
	Version    string `json:"version"`
	MajorMinor string `json:"majorMinor,omitempty"`
	BuildType  string `json:"buildType,omitempty"`
	RawVersion string `json:"rawVersion,omitempty"`
}

type RunDoc struct {
	ID            string            `json:"id"`
	Attempt       int               `json:"attempt,omitempty"`
	Status        string            `json:"status,omitempty"`
	DateTime      string            `json:"dateTime,omitempty"`
	BuildURL      string            `json:"buildURL,omitempty"`
	PipelineGroup string            `json:"pipelineGroup,omitempty"`
	TestID        string            `json:"testId,omitempty"`
	ClusterID     string            `json:"clusterId,omitempty"`
	ServerBuildID string            `json:"serverBuildId,omitempty"`
	Versions      map[string]string `json:"versions,omitempty"`
}

type PaginatedTimelinesResponse struct {
	Panels []TimelinePanel `json:"panels"`
	Total  int             `json:"total"`
	Limit  int             `json:"limit"`
	Offset int             `json:"offset"`
}

type TimelinePanel struct {
	MetricID         string               `json:"metricId"`
	Title            string               `json:"title"`
	Category         string               `json:"category"`
	SubCategory      string               `json:"subCategory"`
	Component        string               `json:"component"`
	ClusterID        string               `json:"cluster"`
	ClusterInfo      *TimelineClusterInfo `json:"clusterInfo,omitempty"`
	Tags             map[string]string    `json:"tags,omitempty"`
	BenchmarksValues []TimelinePoint      `json:"benchmarksValues"`
	Chirality        int                  `json:"chirality"`
	Threshold        *float64             `json:"threshold,omitempty"`
}

type TimelineClusterInfo struct {
	Name   string `json:"name"`
	OS     string `json:"os"`
	CPU    string `json:"cpu"`
	Disk   string `json:"disk"`
	Memory string `json:"memory"`
}

type BuildInfo struct {
	BuildURL  string   `json:"buildUrl"`
	Snapshots []string `json:"snapshots"`
}

type TimelinePoint struct {
	Build     string   `json:"build"`
	Value     float64  `json:"value"`
	BuildURL  string   `json:"buildUrl,omitempty"`
	Snapshots []string `json:"snapshots,omitempty"`
	RunID     string   `json:"runId,omitempty"`
}

type Run map[string]interface{}

// RunDetail is the fully-joined response for the benchmark detail drawer.

type RunVersions struct {
	SDK       *string `json:"sdk"`
	TLS       *string `json:"tls"`
	Capella   *string `json:"capella"`
	AIGateway *string `json:"aiGateway"`
}

type RunDetailBenchmark struct {
	RunID         string   `json:"runId"`
	Value         float64  `json:"value"`
	Build         string   `json:"build"`
	OS            string   `json:"os"`
	DateTime      string   `json:"dateTime"`
	PipelineGroup string   `json:"pipelineGroup"`
	Hidden        bool     `json:"hidden"`
	Snapshots     []string `json:"snapshots"`
}

// RunSummary is one entry in the Reruns list — all benchmark executions
// for the same metric + build combination.
type RunSummary struct {
	RunID     string      `json:"runId"`
	Value     float64     `json:"value"`
	DateTime  string      `json:"dateTime"`
	Attempt   int         `json:"attempt"`
	BuildURL  string      `json:"buildUrl"`
	Snapshots []string    `json:"snapshots"`
	Versions  RunVersions `json:"versions"`
	Hidden    bool        `json:"hidden"`
}

type RunDetailMetric struct {
	Title       string `json:"title"`
	Component   string `json:"component"`
	Category    string `json:"category"`
	SubCategory string `json:"subCategory"`
	Chirality   *int   `json:"chirality"`
	MemQuota    int64  `json:"memquota"`
	Provider    string `json:"provider"`
}

type RunDetailRun struct {
	BuildURL string      `json:"buildUrl"`
	DateTime string      `json:"dateTime"`
	Attempt  int         `json:"attempt"`
	Versions RunVersions `json:"versions"`
}

type RunDetailTest struct {
	Title      string                 `json:"title"`
	TestConfig string                 `json:"testConfig"`
	Threshold  *float64               `json:"threshold"`
	Tags       map[string]interface{} `json:"tags"`
}

type RunDetailCluster struct {
	Name     string `json:"name"`
	OS       string `json:"os"`
	CPU      string `json:"cpu"`
	Memory   string `json:"memory"`
	Disk     string `json:"disk"`
	Provider string `json:"provider"`
}

type RunDetailBuild struct {
	Version    string `json:"version"`
	MajorMinor string `json:"majorMinor"`
	BuildType  string `json:"buildType"`
}

type RunDetail struct {
	Benchmark RunDetailBenchmark `json:"benchmark"`
	Metric    RunDetailMetric    `json:"metric"`
	Run       RunDetailRun       `json:"run"`
	Test      RunDetailTest      `json:"test"`
	Cluster   RunDetailCluster   `json:"cluster"`
	Build     RunDetailBuild     `json:"build"`
	Reruns    []RunSummary       `json:"reruns"`
}

type ComponentStatus struct {
	Component string `json:"component"`
	Total     int    `json:"total"`
	Passed    int    `json:"passed"`
	Warning   int    `json:"warning"`
	Regressed  int    `json:"regressed"`
	Neutral   int    `json:"neutral"`
}

type WeeklyBuildEntry struct {
	Build  string `json:"build"`
	Date   string `json:"date"`
	Active bool   `json:"active"`
}

type WeeklyBuildsResponse struct {
	Builds []WeeklyBuildEntry `json:"builds"`
}

type WeeklyMetricResult struct {
	MetricID    string   `json:"metricId"`
	Title       string   `json:"title"`
	Component   string   `json:"component"`
	Category    string   `json:"category"`
	SubCategory string   `json:"subCategory"`
	Value       float64  `json:"value"`
	Baseline    float64  `json:"baseline"`
	Status      string   `json:"status"`
	BuildURL    string   `json:"buildUrl"`
	Chirality   int      `json:"chirality"`
	Threshold   *float64 `json:"threshold,omitempty"`
}

type WeeklyComponentDetail struct {
	Component string               `json:"component"`
	Metrics   []WeeklyMetricResult `json:"metrics"`
}

type WeeklyDetailResponse struct {
	Build      string                  `json:"build"`
	Date       string                  `json:"date"`
	Components []WeeklyComponentDetail `json:"components"`
}

// WeeklyDoc is a pre-computed summary stored in showfast.management.weekly.
// Key: "weekly::<build>". Generated by GenerateWeeklyDocs at the end of each
// weekly pipeline run.
type WeeklyDoc struct {
	Build       string            `json:"build"`
	Date        string            `json:"date"`
	GeneratedAt string            `json:"generatedAt"`
	Components  []ComponentStatus `json:"components"`
}

// PipelineDoc mirrors a document in showfast.management.pipelines.
type PipelineDoc struct {
	Build  string `json:"build"`
	Type   string `json:"type"`
	Date   string `json:"date"`
	Active bool   `json:"active"`
}

type PipelineSummary struct {
	Build      string            `json:"build"`
	Type       string            `json:"type"`
	Date       string            `json:"date"`
	Components []ComponentStatus `json:"components"`
}

type PipelineSummaryResponse struct {
	Pipelines []PipelineSummary `json:"pipelines"`
}

type JenkinsRun struct {
	TestConfig string `json:"test_config"`
	Cluster    string `json:"cluster"`
	Version    string `json:"version"`
	Component  string `json:"component"`
	Duration   int64  `json:"duration"`
	Job        string `json:"job"`
	Success    bool   `json:"success"`
	Timestamp  int64  `json:"timestamp"`
	URL        string `json:"url"`
}

type JenkinsRunsResponse struct {
	Runs []JenkinsRun `json:"runs"`
}
