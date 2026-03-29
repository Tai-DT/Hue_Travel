package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AdminSettingsRepository stores admin-managed runtime configuration drafts.
type AdminSettingsRepository struct {
	pool *pgxpool.Pool
}

func NewAdminSettingsRepository(pool *pgxpool.Pool) *AdminSettingsRepository {
	return &AdminSettingsRepository{pool: pool}
}

func (r *AdminSettingsRepository) List(ctx context.Context) (map[string]string, *time.Time, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT setting_key, setting_value, updated_at
		FROM admin_settings
		ORDER BY setting_key`)
	if err != nil {
		return nil, nil, fmt.Errorf("query admin settings: %w", err)
	}
	defer rows.Close()

	settings := make(map[string]string)
	var latest *time.Time

	for rows.Next() {
		var key string
		var value string
		var updatedAt time.Time
		if err := rows.Scan(&key, &value, &updatedAt); err != nil {
			return nil, nil, fmt.Errorf("scan admin setting: %w", err)
		}
		settings[key] = value
		if latest == nil || updatedAt.After(*latest) {
			snapshot := updatedAt
			latest = &snapshot
		}
	}

	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("iterate admin settings: %w", err)
	}

	return settings, latest, nil
}

func (r *AdminSettingsRepository) UpsertMany(ctx context.Context, values map[string]string, updatedBy uuid.UUID) (*time.Time, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin settings tx: %w", err)
	}
	defer tx.Rollback(ctx)

	for key, value := range values {
		if _, err := tx.Exec(ctx, `
			INSERT INTO admin_settings (setting_key, setting_value, updated_by, updated_at)
			VALUES ($1, $2, $3, NOW())
			ON CONFLICT (setting_key)
			DO UPDATE SET
				setting_value = EXCLUDED.setting_value,
				updated_by = EXCLUDED.updated_by,
				updated_at = NOW()`,
			key, value, updatedBy,
		); err != nil {
			return nil, fmt.Errorf("upsert admin setting %s: %w", key, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit settings tx: %w", err)
	}

	if len(values) == 0 {
		return nil, nil
	}

	var latest time.Time
	if err := r.pool.QueryRow(ctx, `SELECT MAX(updated_at) FROM admin_settings`).Scan(&latest); err != nil {
		return nil, fmt.Errorf("query admin settings latest timestamp: %w", err)
	}

	return &latest, nil
}
