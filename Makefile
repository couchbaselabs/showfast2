.PHONY: build-plugin build-docker reload-docker clean-plugin reload-backend-and-docker

# Build frontend assets and backend binaries into dist/
build-plugin:
	@cd cbperf-showfast-app/ && \
	npm install && \
	npm run build && \
	mage

reload-backend-and-docker:
	@cd cbperf-showfast-app/ && \
	mage && \
	docker restart cbperf-showfast-app

build-docker: build-plugin
	@cd cbperf-showfast-app && \
 	docker compose --env-file .env up --build -d

# Reload Grafana so updated plugin artifacts are reloaded from the bind mount
reload-docker:
	@docker restart cbperf-showfast-app

# Remove generated artifacts and local caches to prepare for a clean build
clean-plugin:
	@cd cbperf-showfast-app/ && rm -rf dist node_modules/.cache .cache
	@cd cbperf-showfast-app/ && go clean -cache -testcache && mage clean