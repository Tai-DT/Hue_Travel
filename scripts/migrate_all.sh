#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_CMD=(docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U huetravel -d hue_travel)
MIGRATIONS=(
  "apps/api/migrations/001_initial_schema.sql"
  "apps/api/migrations/003_social_features.sql"
  "apps/api/migrations/004_chat_social.sql"
  "apps/api/migrations/005_weather_coupon_gamification.sql"
  "apps/api/migrations/006_blog_diary_events_sos.sql"
  "apps/api/migrations/008_new_features.sql"
  "apps/api/migrations/009_admin_settings.sql"
  "apps/api/migrations/010_user_preferences.sql"
)

for migration in "${MIGRATIONS[@]}"; do
  echo "Applying ${migration}..."
  "${DB_CMD[@]}" < "${migration}"
done

echo "Migrations applied successfully."
