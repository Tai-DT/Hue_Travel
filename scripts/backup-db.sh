#!/bin/bash
# ============================================
# Huế Travel — Database Backup Script
# ============================================
# Usage: ./scripts/backup-db.sh
# Cron:  0 2 * * * /path/to/scripts/backup-db.sh
# ============================================

set -euo pipefail

# ---- Config ----
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_NAME="${POSTGRES_DB:-hue_travel}"
DB_USER="${POSTGRES_USER:-huetravel}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# ---- Create backup dir ----
mkdir -p "${BACKUP_DIR}"

echo "📦 [$(date)] Starting backup of ${DB_NAME}..."

# ---- Dump + compress ----
if command -v docker &> /dev/null && docker ps | grep -q ht-postgres; then
  # Docker mode
  echo "🐳 Using Docker container..."
  docker exec ht-postgres pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --clean --if-exists | gzip > "${BACKUP_FILE}"
else
  # Direct mode
  echo "📋 Using direct connection..."
  PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --no-owner --clean --if-exists | gzip > "${BACKUP_FILE}"
fi

# ---- Verify ----
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "✅ Backup completed: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ---- Cleanup old backups ----
DELETED=$(find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
if [ "${DELETED}" -gt 0 ]; then
  echo "🗑️  Cleaned up ${DELETED} old backup(s) (>${RETENTION_DAYS} days)"
fi

# ---- Summary ----
TOTAL_COUNT=$(find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz" | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
echo "📊 Total: ${TOTAL_COUNT} backups, ${TOTAL_SIZE}"
echo "🕐 [$(date)] Done!"
