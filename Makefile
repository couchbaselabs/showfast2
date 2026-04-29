.PHONY: build-plugin build-docker reload-plugin clean-plugin

# Build frontend assets and backend binaries into dist/
build-plugin:
	@cd cbperf-showfast-app/ && \
	npm install && \
	npm run build && \
	mage -v

build-docker: build-plugin
	@cd cbperf-showfast-app && \
 	docker compose --env-file .env up --build -d

# Reload Grafana so updated plugin artifacts are reloaded from the bind mount
reload-plugin:
	@docker restart cbperf-showfast-app

# Remove generated artifacts and local caches to prepare for a clean build
clean-plugin:
	@cd cbperf-showfast-app/ && rm -rf dist node_modules/.cache .cache
	@cd cbperf-showfast-app/ && go clean -cache -testcache && mage clean