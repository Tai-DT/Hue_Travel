#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_CMD=(docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U huetravel -d hue_travel)

echo "Resetting public schema..."
"${DB_CMD[@]}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "Rebuilding schema..."
./scripts/migrate_all.sh

echo "Clearing baseline migration seed rows..."
"${DB_CMD[@]}" -c "TRUNCATE TABLE achievements, local_events, blog_posts RESTART IDENTITY CASCADE;"

echo "Loading demo auth seed..."
"${DB_CMD[@]}" < scripts/seed.sql

echo "Loading comprehensive local seed..."
"${DB_CMD[@]}" < scripts/seed_real_data.sql

echo "Database reset complete."
