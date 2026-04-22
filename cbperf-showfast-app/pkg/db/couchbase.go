package db

import (
	"os"
	"fmt"

	"github.com/couchbase/gocb"
)

type DataStore struct {
	cluster *gocb.Cluster
	buckets map[string]*gocb.Bucket
}

var couchbaseBuckets = []string{"benchmarks", "metrics", "clusters"}

func NewDataStore() (*DataStore, error) {
	connString := os.Getenv("CB_CONN_STRING")
	username := os.Getenv("CB_USERNAME")
	password := os.Getenv("CB_PASSWORD")

	if connString == "" || username == "" || password == "" {
		return nil, fmt.Errorf("Missing environment variables. Currently: CB_CONN_STRING=%s, CB_USERNAME=%s, CB_PASSWORD=%s", connString, username, password)
	}

	cluster, err := gocb.Connect(connString)
	if err != nil {
		return nil, fmt.Errorf("Failed to connect to Couchbase cluster: %v", err)
	}
	err = cluster.Authenticate(gocb.PasswordAuthenticator{
		Username: username,
		Password: password,
	})
	if err != nil {
		return nil, fmt.Errorf("Failed to authenticate with Couchbase cluster: %v", err)
	}

	ds := &DataStore{
		cluster: cluster,
		buckets: make(map[string]*gocb.Bucket),
	}

	for _, bucketName := range couchbaseBuckets {
		bucket, err := cluster.OpenBucket(bucketName, "")
		if err != nil {
			return nil, fmt.Errorf("Failed to open Couchbase bucket %s: %v", bucketName, err)
		}
		ds.buckets[bucketName] = bucket
	}

	return ds, nil
}

func (ds *DataStore) GetBucket(bucketName string) (*gocb.Bucket, error) {
	bucket, exists := ds.buckets[bucketName]
	if !exists {
		return nil, fmt.Errorf("Bucket %s not found in DataStore", bucketName)
	}
	return bucket, nil
}

func (ds *DataStore) GetCluster() (*gocb.Cluster, error) {
	if ds.cluster == nil {
		return nil, fmt.Errorf("Couchbase cluster not initialized")
	}
	return ds.cluster, nil
}
