package db

import (
	"fmt"
	"os"
	"time"

	"github.com/couchbase/gocb/v2"
)

type DataStore struct {
	cluster     *gocb.Cluster
	collections map[string]*gocb.Collection
}

var couchbaseBuckets = []string{"benchmarks", "metrics", "clusters"}

const couchbaseReadyTimeout = 30 * time.Second

// func loadEnvFromFile(path string) {
// 	file, err := os.Open(path)
// 	if err != nil {
// 		return
// 	}
// 	defer file.Close()

// 	scanner := bufio.NewScanner(file)
// 	for scanner.Scan() {
// 		line := strings.TrimSpace(scanner.Text())
// 		if line == "" || strings.HasPrefix(line, "#") {
// 			continue
// 		}

// 		parts := strings.SplitN(line, "=", 2)
// 		if len(parts) != 2 {
// 			continue
// 		}

// 		key := strings.TrimSpace(parts[0])
// 		value := strings.TrimSpace(parts[1])
// 		if key == "" || value == "" {
// 			continue
// 		}

// 		if _, exists := os.LookupEnv(key); !exists {
// 			_ = os.Setenv(key, value)
// 		}
// 	}
// }

func NewDataStore() (*DataStore, error) {
	connString := os.Getenv("CB_CONN_STRING")
	username := os.Getenv("CB_USERNAME")
	password := os.Getenv("CB_PASSWORD")

	if connString == "" || username == "" || password == "" {
		return nil, fmt.Errorf("Missing environment variables. Currently: CB_CONN_STRING=%s, CB_USERNAME=%s, CB_PASSWORD=%s", connString, username, password)
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

	for _, bucketName := range couchbaseBuckets {
		bucket := cluster.Bucket(bucketName)
		if err := bucket.WaitUntilReady(couchbaseReadyTimeout, nil); err != nil {
			return nil, fmt.Errorf("Failed to open Couchbase bucket %s: %v", bucketName, err)
		}
		ds.collections[bucketName] = bucket.DefaultCollection()
	}

	return ds, nil
}

func (ds *DataStore) GetCollection(bucketName string) *gocb.Collection {
	return ds.collections[bucketName]
}

func (ds *DataStore) GetCluster() *gocb.Cluster {
	return ds.cluster
}
