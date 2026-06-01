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
}

type Run map[string]interface{}
