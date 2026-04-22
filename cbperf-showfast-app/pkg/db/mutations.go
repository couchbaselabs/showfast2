package db

import (
	"fmt"

	"github.com/cbperf/showfast/pkg/models"
	"github.com/couchbase/gocb/v2"
)

func (ds *DataStore) AddMetric(metric models.Metric) error {
	collection := ds.GetCollection("metrics")

	_, err := collection.Upsert(metric.ID, metric, nil)
	return err
}

// inserts/updates a hardware/os profile
func (ds *DataStore) AddCluster(cluster models.Cluster) error {
	collection := ds.GetCollection("clusters")
	_, err := collection.Upsert(cluster.Name, cluster, nil)
	return err
}

func (ds *DataStore) AddBenchmark(benchmark models.Benchmark) error {
	queryStr := ` 
				SELECT RAW META(b).id FROM benchmarks b
				WHERE b.metric = $metric AND b.build = $build AND b.hidden = False
				`
	params := map[string]interface{}{
		"metric": benchmark.Metric,
		"build":  benchmark.Build,
	}

	rows, err := ds.cluster.Query(queryStr, &gocb.QueryOptions{NamedParameters: params})
	if err != nil {
		return fmt.Errorf("failed to execute query to check for existing benchmark: %v", err)
	}
	defer rows.Close()

	collection := ds.GetCollection("benchmarks")

	var existingID string
	for rows.Next() {
		if err := rows.Row(&existingID); err != nil {
			return fmt.Errorf("failed to read existing benchmark row: %v", err)
		}
		var existing models.Benchmark
		getResult, err := collection.Get(existingID, nil)
		if err != nil {
			return fmt.Errorf("failed to get existing benchmark %s: %v", existingID, err)
		}
		if err := getResult.Content(&existing); err != nil {
			return fmt.Errorf("failed to read benchmark content %s: %v", existingID, err)
		}
		existing.Hidden = true
		_, err = collection.Upsert(existingID, existing, nil)
		if err != nil {
			return fmt.Errorf("failed to hide previous benchmark %s: %v", existingID, err)
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("failed while reading benchmark query results: %v", err)
	}

	_, err = collection.Upsert(benchmark.ID, benchmark, nil)
	if err != nil {
		return fmt.Errorf("failed to add benchmark with ID %s: %v", benchmark.ID, err)
	}
	return nil
}

func (ds *DataStore) ToggleBenchmarkHidden(benchmarkID string) error {
	collection := ds.GetCollection("benchmarks")

	var benchmark models.Benchmark
	getResult, err := collection.Get(benchmarkID, nil)
	if err != nil {
		return fmt.Errorf("failed to get benchmark with ID %s: %v", benchmarkID, err)
	}
	if err := getResult.Content(&benchmark); err != nil {
		return fmt.Errorf("failed to read benchmark content with ID %s: %v", benchmarkID, err)
	}

	benchmark.Hidden = !benchmark.Hidden
	_, err = collection.Upsert(benchmarkID, benchmark, nil)
	if err != nil {
		return fmt.Errorf("failed to update hidden status for benchmark with ID %s: %v", benchmarkID, err)
	}
	return nil
}

func (ds *DataStore) DeleteBenchmark(benchmarkID string) error {
	collection := ds.GetCollection("benchmarks")

	_, err := collection.Remove(benchmarkID, nil)
	if err != nil {
		return fmt.Errorf("failed to delete benchmark with ID %s: %v", benchmarkID, err)
	}
	return nil
}
