package models

type Benchmark struct {
	Build     string   `json:"build"`
	BuildUrl  string   `json:"buildUrl"`
	DateTime  string   `json:"dateTime"`
	ID        string   `json:"id"`
	Metric    string   `json:"metric"`
	Hidden    bool     `json:"hidden"`
	Snapshots []string `json:"snapshots"`
	Value     float64  `json:"value"`
}

type Cluster struct {
	CPU    string `json:"cpu"`
	Disk   string `json:"disk"`
	Memory string `json:"memory"`
	Name   string `json:"name"`
	OS     string `json:"os"`
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
	Tags        map[string]string `json:"tags,omitempty"`
}

type Run map[string]interface{}
