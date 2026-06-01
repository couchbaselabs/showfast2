package db

import (
	"fmt"
	"time"

	"github.com/couchbase/gocb/v2"
)

type DataStore struct {
	cluster     *gocb.Cluster
	collections map[string]*gocb.Collection
}

const (
	couchbaseBucketName = "showfast"
	couchbaseScopeName  = "showfast"
	benchmarksKeyspace  = "`showfast`.`showfast`.`benchmarks`"
	metricsKeyspace     = "`showfast`.`showfast`.`metrics`"
	clustersKeyspace    = "`showfast`.`showfast`.`clusters`"
	runsKeyspace        = "`showfast`.`showfast`.`runs`"
	testsKeyspace       = "`showfast`.`showfast`.`tests`"
	buildsKeyspace      = "`showfast`.`showfast`.`builds`"
)

var couchbaseCollections = []string{"benchmarks", "metrics", "clusters", "runs", "tests", "builds"}

const couchbaseReadyTimeout = 30 * time.Second

func NewDataStore(connString, username, password string) (*DataStore, error) {
	if connString == "" || username == "" || password == "" {
		return nil, fmt.Errorf("Missing Couchbase credentials. Currently: CB_CONN_STRING=%s, CB_USERNAME=%s, CB_PASSWORD=%s", connString, username, password)
	}

	cluster, err := gocb.Connect(connString, gocb.ClusterOptions{
		Authenticator: gocb.PasswordAuthenticator{
			Username: username,
			Password: password,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("Failed to connect to Couchbase cluster: %v", err)
	}

	if err := cluster.WaitUntilReady(couchbaseReadyTimeout, nil); err != nil {
		cluster.Close(nil)
		return nil, fmt.Errorf("Failed to wait for Couchbase cluster readiness: %v", err)
	}

	ds := &DataStore{
		cluster:     cluster,
		collections: make(map[string]*gocb.Collection),
	}

	bucket := cluster.Bucket(couchbaseBucketName)
	if err := bucket.WaitUntilReady(couchbaseReadyTimeout, nil); err != nil {
		return nil, fmt.Errorf("Failed to open Couchbase bucket %s: %v", couchbaseBucketName, err)
	}

	scope := bucket.Scope(couchbaseScopeName)
	for _, collectionName := range couchbaseCollections {
		ds.collections[collectionName] = scope.Collection(collectionName)
	}

	return ds, nil
}

func (ds *DataStore) GetCollection(bucketName string) *gocb.Collection {
	return ds.collections[bucketName]
}

func (ds *DataStore) GetCluster() *gocb.Cluster {
	return ds.cluster
}
