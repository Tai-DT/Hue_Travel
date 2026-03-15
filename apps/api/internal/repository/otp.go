package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/huetravel/api/internal/model"
)

// ============================================
// OTP Repository
// ============================================

type OTPRepository struct {
	pool *pgxpool.Pool
}

func NewOTPRepository(pool *pgxpool.Pool) *OTPRepository {
	return &OTPRepository{pool: pool}
}

func (r *OTPRepository) Create(ctx context.Context, phone, code string, expiresAt time.Time) (*model.OTPVerification, error) {
	otp := &model.OTPVerification{
		ID:        uuid.New(),
		Phone:     phone,
		Code:      code,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO otp_verifications (id, phone, code, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5)`,
		otp.ID, otp.Phone, otp.Code, otp.ExpiresAt, otp.CreatedAt,
	)
	return otp, err
}

func (r *OTPRepository) Verify(ctx context.Context, phone, code string) (bool, error) {
	var id uuid.UUID
	err := r.pool.QueryRow(ctx, `
		SELECT id FROM otp_verifications 
		WHERE phone = $1 AND code = $2 AND verified = FALSE 
		AND expires_at > NOW() AND attempts < 5
		ORDER BY created_at DESC LIMIT 1`, phone, code,
	).Scan(&id)

	if err == pgx.ErrNoRows {
		// Increment attempts on the latest OTP
		r.pool.Exec(ctx, `
			UPDATE otp_verifications SET attempts = attempts + 1 
			WHERE phone = $1 AND verified = FALSE 
			ORDER BY created_at DESC LIMIT 1`, phone)
		return false, nil
	}
	if err != nil {
		return false, err
	}

	// Mark as verified
	_, err = r.pool.Exec(ctx,
		`UPDATE otp_verifications SET verified = TRUE WHERE id = $1`, id)
	return true, err
}

// CleanExpired — Clean old OTP records
func (r *OTPRepository) CleanExpired(ctx context.Context) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM otp_verifications WHERE expires_at < NOW() - INTERVAL '1 hour'`)
	return err
}
