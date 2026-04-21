.PHONY: build-plugin reload-plugin clean-plugin

# Build frontend assets and backend binaries into dist/
build-plugin:
	cd cbperf-showfast-app/ && npm run build
	cd cbperf-showfast-app/ && mage -v

# Reload Grafana so updated plugin artifacts are reloaded from the bind mount
reload-plugin:
	cd cbperf-showfast-app/ && docker compose restart grafana

# Remove generated artifacts and local caches to prepare for a clean build
clean-plugin:
	cd cbperf-showfast-app/ && rm -rf dist node_modules/.cache .cache
	cd cbperf-showfast-app/ && go clean -cache -testcache