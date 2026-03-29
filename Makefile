.PHONY: help dev infra-up infra-down infra-reset api api-build api-test migrate seed seed-real db-shell db-reset db-schema-reset smoke smoke-api smoke-auth smoke-booking setup backup restore ssl-setup deploy

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
	./scripts/migrate_all.sh

seed: ## Load demo seed data
	@echo "Seeding demo data..."
	docker compose exec -T postgres psql -U huetravel -d hue_travel < scripts/seed.sql

seed-real: ## Load comprehensive local seed data (expects a clean DB)
	@echo "Seeding comprehensive local data..."
	docker compose exec -T postgres psql -U huetravel -d hue_travel < scripts/seed_real_data.sql

db-shell: ## Open PostgreSQL shell
	docker compose exec postgres psql -U huetravel -d hue_travel

db-schema-reset: ## Reset database schema only (no migrations or seed)
	docker compose exec -T postgres psql -U huetravel -d hue_travel -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

db-reset: ## Reset DB and rebuild a clean local dev dataset
	./scripts/reset_dev_db.sh

smoke: ## Validate local infra health and schema consistency
	./scripts/smoke-stack.sh

smoke-api: ## Validate local API public endpoints (set API_BASE if needed)
	./scripts/smoke-api.sh

smoke-auth: ## Validate email/password auth, refresh, and logout flow (set API_BASE/EMAIL/PASSWORD if needed)
	./scripts/smoke-auth.sh

smoke-booking: ## Validate email/password auth, booking create, payment create, and logout flow
	./scripts/smoke-booking.sh

# ---- Setup ----
setup: ## First-time project setup
	cp -n .env.example .env || true
	$(MAKE) infra-up
	@echo "⏳ Waiting for PostgreSQL to be ready..."
	sleep 5
	@echo "✅ Setup complete! Run 'make api' to start the server."

# ---- All ----
dev: infra-up api ## Start everything (infra + API)

# ---- Backup / Restore ----
backup: ## Backup database
	./scripts/backup-db.sh

restore: ## Restore database (usage: make restore FILE=backups/xxx.sql.gz)
	./scripts/restore-db.sh $(FILE)

# ---- SSL ----
ssl-setup: ## Setup SSL with Let's Encrypt
	./scripts/setup-ssl.sh

# ---- Deploy ----
deploy: ## Deploy to production
	cd deploy && docker compose -f docker-compose.prod.yml pull
	cd deploy && docker compose -f docker-compose.prod.yml up -d
	@echo "🚀 Deployed!"
