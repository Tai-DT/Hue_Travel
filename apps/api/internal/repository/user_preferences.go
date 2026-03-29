package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/huetravel/api/internal/model"
)

type UserPreferencesRepository struct {
	pool *pgxpool.Pool
}

func NewUserPreferencesRepository(pool *pgxpool.Pool) *UserPreferencesRepository {
	return &UserPreferencesRepository{pool: pool}
}

func DefaultUserPreferences(userID uuid.UUID) *model.UserPreferences {
	return &model.UserPreferences{
		UserID:                    userID,
		Locale:                    "vi",
		Currency:                  "VND",
		Region:                    "Hue, Vietnam",
		PushNotificationsEnabled:  true,
		EmailNotificationsEnabled: true,
		ChatNotificationsEnabled:  true,
		PromoNotificationsEnabled: false,
	}
}

func (r *UserPreferencesRepository) Get(ctx context.Context, userID uuid.UUID) (*model.UserPreferences, error) {
	prefs := DefaultUserPreferences(userID)

	err := r.pool.QueryRow(ctx, `
		SELECT user_id, locale, currency, region,
		       push_notifications_enabled, email_notifications_enabled,
		       chat_notifications_enabled, promo_notifications_enabled, updated_at
		FROM user_preferences
		WHERE user_id = $1`,
		userID,
	).Scan(
		&prefs.UserID,
		&prefs.Locale,
		&prefs.Currency,
		&prefs.Region,
		&prefs.PushNotificationsEnabled,
		&prefs.EmailNotificationsEnabled,
		&prefs.ChatNotificationsEnabled,
		&prefs.PromoNotificationsEnabled,
		&prefs.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		prefs.UpdatedAt = time.Time{}
		return prefs, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get user preferences: %w", err)
	}

	return prefs, nil
}

func (r *UserPreferencesRepository) Upsert(ctx context.Context, prefs *model.UserPreferences) (*model.UserPreferences, error) {
	if prefs == nil {
		return nil, fmt.Errorf("preferences required")
	}

	stored := &model.UserPreferences{}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO user_preferences (
			user_id, locale, currency, region,
			push_notifications_enabled, email_notifications_enabled,
			chat_notifications_enabled, promo_notifications_enabled, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			locale = EXCLUDED.locale,
			currency = EXCLUDED.currency,
			region = EXCLUDED.region,
			push_notifications_enabled = EXCLUDED.push_notifications_enabled,
			email_notifications_enabled = EXCLUDED.email_notifications_enabled,
			chat_notifications_enabled = EXCLUDED.chat_notifications_enabled,
			promo_notifications_enabled = EXCLUDED.promo_notifications_enabled,
			updated_at = NOW()
		RETURNING user_id, locale, currency, region,
		          push_notifications_enabled, email_notifications_enabled,
		          chat_notifications_enabled, promo_notifications_enabled, updated_at`,
		prefs.UserID,
		prefs.Locale,
		prefs.Currency,
		prefs.Region,
		prefs.PushNotificationsEnabled,
		prefs.EmailNotificationsEnabled,
		prefs.ChatNotificationsEnabled,
		prefs.PromoNotificationsEnabled,
	).Scan(
		&stored.UserID,
		&stored.Locale,
		&stored.Currency,
		&stored.Region,
		&stored.PushNotificationsEnabled,
		&stored.EmailNotificationsEnabled,
		&stored.ChatNotificationsEnabled,
		&stored.PromoNotificationsEnabled,
		&stored.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("upsert user preferences: %w", err)
	}

	return stored, nil
}

func (r *UserPreferencesRepository) CountDevices(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM device_tokens WHERE user_id = $1`, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count device tokens: %w", err)
	}
	return count, nil
}
