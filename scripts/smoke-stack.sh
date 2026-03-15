#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Starting local infrastructure..."
docker compose up -d postgres redis minio meilisearch >/dev/null

echo "Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U huetravel -d hue_travel >/dev/null 2>&1; do
  sleep 2
done

echo "Checking PostgreSQL schema..."
guide_available_column="$(docker compose exec -T postgres psql -tAc "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'guide_profiles' AND column_name = 'is_available'" -U huetravel -d hue_travel | tr -d '[:space:]')"
reviews_featured_column="$(docker compose exec -T postgres psql -tAc "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'is_featured'" -U huetravel -d hue_travel | tr -d '[:space:]')"
core_tables_count="$(docker compose exec -T postgres psql -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'experiences', 'bookings', 'reviews', 'chat_rooms')" -U huetravel -d hue_travel | tr -d '[:space:]')"

if [[ "$guide_available_column" != "is_available" ]]; then
  echo "Missing guide_profiles.is_available"
  exit 1
fi

if [[ "$reviews_featured_column" != "is_featured" ]]; then
  echo "Missing reviews.is_featured"
  exit 1
fi

if [[ "$core_tables_count" != "5" ]]; then
  echo "Unexpected table count for core tables: $core_tables_count"
  exit 1
fi

echo "Checking Redis..."
redis_status="$(docker compose exec -T redis redis-cli ping | tr -d '[:space:]')"
if [[ "$redis_status" != "PONG" ]]; then
  echo "Redis is not healthy"
  exit 1
fi

echo "Checking Meilisearch..."
curl -fsS http://localhost:7700/health >/dev/null

echo "Infrastructure smoke check passed."
