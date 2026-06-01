package api

import (
	"context"
	"net/http"
	"strings"

	"github.com/cbperf/showfast/pkg/db"
	"github.com/gin-gonic/gin"
)

func executeAndRespond(c *gin.Context, status int, fn func(context.Context) (interface{}, error)) {
	result, err := fn(extractContextFromGin(c))
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.JSON(status, result)
}

func bindJSONOrAbort(c *gin.Context, dst interface{}) bool {
	if err := c.ShouldBindJSON(dst); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return false
	}

	return true
}

func requireQueryParam(c *gin.Context, key string) (string, bool) {
	value := c.Query(key)
	if value == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": key + " query parameter is required"})
		return "", false
	}

	return value, true
}

func requirePathParam(c *gin.Context, key string) (string, bool) {
	value := c.Param(key)
	if value == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": key + " parameter is required"})
		return "", false
	}

	return value, true
}

func extractContextFromGin(c *gin.Context) context.Context {
	return c.Request.Context()
}

func normalizeQuerySlice(raw []string) []string {
	var normalized []string
	for _, item := range raw {
		for _, part := range strings.Split(item, ",") {
			v := strings.TrimSpace(part)
			v = strings.Trim(v, `"`)
			if v != "" {
				normalized = append(normalized, v)
			}
		}
	}
	return normalized
}

// parses url query params like tag.foo=v1,v2 or tag.foo=v1&tag.foo=v2
func extractTagsFromQuery(c *gin.Context) map[string][]string {
	tags := make(map[string][]string)
	for key, values := range c.Request.URL.Query() {
		tagKey := ""
		if strings.HasPrefix(key, "tag.") {
			tagKey = strings.TrimPrefix(key, "tag.")
		} else if strings.HasPrefix(key, "var-tag.") {
			tagKey = strings.TrimPrefix(key, "var-tag.")
		}

		if tagKey == "" {
			continue
		}

		normalized := normalizeQuerySlice(values)
		if len(normalized) > 0 {
			tags[tagKey] = append(tags[tagKey], normalized...)
		}
	}
	return tags
}

// queryValues supports both repeated params (?component=kv&component=index)
// and comma-separated (?component=kv,index,fts) for convenience with pill dropdowns.
func queryValues(c *gin.Context, key string) []string { return normalizeQuerySlice(c.QueryArray(key)) }

func parseFilterOptions(c *gin.Context) db.FilterOptions {
	return db.FilterOptions{
		Components:        queryValues(c, "component"),
		Categories:        queryValues(c, "category"),
		Subcategories:     queryValues(c, "subcategory"),
		Clusters:          queryValues(c, "cluster"),
		OS:                queryValues(c, "os"),
		PipelineGroups:    queryValues(c, "pipelineGroup"),
		ServerMajorMinors: queryValues(c, "serverMajorMinor"),
		Tags:              extractTagsFromQuery(c),
	}
}
