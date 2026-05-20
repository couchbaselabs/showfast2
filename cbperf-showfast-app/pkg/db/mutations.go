package db

import (
	"context"
	"fmt"

	"github.com/cbperf/showfast/pkg/models"
	"github.com/couchbase/gocb/v2"
)

func (ds *DataStore) AddMetric(metric models.Metric, c context.Context) error {
	collection := ds.GetCollection("metrics")

	_, err := collection.Upsert(metric.ID, metric, &gocb.UpsertOptions{Context: c})
	return err
}

// inserts/updates a hardware/os profile
func (ds *DataStore) AddCluster(cluster models.Cluster, c context.Context) error {
	collection := ds.GetCollection("clusters")
	_, err := collection.Upsert(cluster.Name, cluster, &gocb.UpsertOptions{Context: c})
	return err
}

func (ds *DataStore) AddBenchmark(benchmark models.Benchmark, c context.Context) error {
	updateQuery := `
		UPDATE benchmarks 
		SET hidden = True 
		WHERE metric = $metric AND build = $build AND hidden = False`
	
	params := map[string]interface{}{
		"metric": benchmark.Metric,
		"build":  benchmark.Build,
	}

	if _, err := ds.cluster.Query(updateQuery, &gocb.QueryOptions{NamedParameters: params, Context: c}); err != nil {
		return fmt.Errorf("failed to hide previous benchmarks: %w", err)
	}

	collection := ds.GetCollection("benchmarks")
	_, err := collection.Upsert(benchmark.ID, benchmark, &gocb.UpsertOptions{Context: c})
	
	return err
}

func (ds *DataStore) ToggleBenchmarkHidden(benchmarkID string, c context.Context) error {
	collection := ds.GetCollection("benchmarks")

	var benchmark models.Benchmark
	getResult, err := collection.Get(benchmarkID, &gocb.GetOptions{Context: c})
	if err != nil {
		return fmt.Errorf("failed to get benchmark with ID %s: %v", benchmarkID, err)
	}
	if err := getResult.Content(&benchmark); err != nil {
		return fmt.Errorf("failed to read benchmark content with ID %s: %v", benchmarkID, err)
	}

	benchmark.Hidden = !benchmark.Hidden
	_, err = collection.Upsert(benchmarkID, benchmark, &gocb.UpsertOptions{Context: c})
	if err != nil {
		return fmt.Errorf("failed to update hidden status for benchmark with ID %s: %v", benchmarkID, err)
	}
	return nil
}

func (ds *DataStore) DeleteBenchmark(benchmarkID string, c context.Context) error {
	collection := ds.GetCollection("benchmarks")

	_, err := collection.Remove(benchmarkID, &gocb.RemoveOptions{Context: c})
	if err != nil {
		return fmt.Errorf("failed to delete benchmark with ID %s: %v", benchmarkID, err)
	}
	return nil
}
