package api

import(
	"context"
	"strings"
	"github.com/gin-gonic/gin"
	"github.com/cbperf/showfast/pkg/db"
)

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
		Components:    queryValues(c, "component"),
		Categories:    queryValues(c, "category"),
		Subcategories: queryValues(c, "subcategory"),
		Clusters:      queryValues(c, "cluster"),
		OS:            queryValues(c, "os"),
		Tags: 		   extractTagsFromQuery(c),
	}
}
