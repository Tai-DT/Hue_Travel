#!/bin/bash
# ============================================
# Huế Travel — Restore Database from Backup
# ============================================
# Usage: ./scripts/restore-db.sh backups/hue_travel_20260313.sql.gz
# ============================================

set -euo pipefail

BACKUP_FILE="${1:-}"
DB_NAME="${POSTGRES_DB:-hue_travel}"
DB_USER="${POSTGRES_USER:-huetravel}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "❌ Usage: $0 <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lh backups/${DB_NAME}_*.sql.gz 2>/dev/null || echo "  (none found)"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ File not found: ${BACKUP_FILE}"
  exit 1
fi

echo "⚠️  WARNING: This will overwrite the current ${DB_NAME} database!"
echo "   Backup: ${BACKUP_FILE}"
read -p "   Continue? (y/N) " confirm
[ "${confirm}" = "y" ] || [ "${confirm}" = "Y" ] || exit 0

echo "🔄 Restoring ${DB_NAME} from ${BACKUP_FILE}..."

if command -v docker &> /dev/null && docker ps | grep -q ht-postgres; then
  # Docker mode
  gunzip -c "${BACKUP_FILE}" | docker exec -i ht-postgres psql -U "${DB_USER}" -d "${DB_NAME}" --single-transaction
else
  # Direct mode
  PGPASSWORD="${POSTGRES_PASSWORD:-}" gunzip -c "${BACKUP_FILE}" | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --single-transaction
fi

echo "✅ Restore completed successfully!"
