.PHONY: help dev infra-up infra-down api migrate

# ============================================
# Huế Travel — Development Commands
# ============================================

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ---- Infrastructure ----
infra-up: ## Start infrastructure (PostgreSQL, Redis, MinIO, Meilisearch)
	docker compose up -d
	@echo "✅ Infrastructure started"
	@echo "   PostgreSQL: localhost:5432"
	@echo "   Redis:      localhost:6379"
	@echo "   MinIO:      localhost:9000 (console: 9001)"
	@echo "   Meili:      localhost:7700"

infra-down: ## Stop infrastructure
	docker compose down
	@echo "⏹️  Infrastructure stopped"

infra-reset: ## Reset all data volumes
	docker compose down -v
	@echo "🗑️  All data volumes removed"

# ---- API (Go) ----
api: ## Run Go API server
	cd apps/api && go run cmd/server/main.go

api-build: ## Build Go API binary
	cd apps/api && go build -o ../../bin/api cmd/server/main.go

api-test: ## Run Go API tests
	cd apps/api && go test ./... -v -cover

# ---- Database ----
migrate: ## Run database migrations
	@echo "Running migrations..."
	docker compose exec -T postgres psql -U huetravel -d hue_travel -f /docker-entrypoint-initdb.d/01-init.sql

db-shell: ## Open PostgreSQL shell
	docker compose exec postgres psql -U huetravel -d hue_travel

db-reset: ## Reset database
	docker compose exec -T postgres psql -U huetravel -d hue_travel -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	$(MAKE) migrate

# ---- Setup ----
setup: ## First-time project setup
	cp -n .env.example .env || true
	$(MAKE) infra-up
	@echo "⏳ Waiting for PostgreSQL to be ready..."
	sleep 5
	@echo "✅ Setup complete! Run 'make api' to start the server."

# ---- All ----
dev: infra-up api ## Start everything (infra + API)
