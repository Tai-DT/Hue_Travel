package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/huetravel/api/internal/model"
)

// ============================================
// User Repository
// ============================================

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

func (r *UserRepository) Create(ctx context.Context, user *model.User) error {
	user.ID = uuid.New()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	if user.Level == "" {
		user.Level = "Newbie"
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO users (id, phone, email, password_hash, full_name, avatar_url, role, bio, languages, xp, level, is_verified, is_active, google_id, apple_id, facebook_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
		user.ID, user.Phone, user.Email, user.PasswordHash,
		user.FullName, user.AvatarURL, user.Role, user.Bio,
		user.Languages, user.XP, user.Level, user.IsVerified, user.IsActive,
		nil, nil, nil, // social IDs
		user.CreatedAt, user.UpdatedAt,
	)
	return err
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	user := &model.User{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, phone, email, full_name, avatar_url, role, bio, languages, 
			   xp, level, is_verified, is_active, last_login_at, created_at, updated_at
		FROM users WHERE id = $1 AND is_active = TRUE`, id,
	).Scan(
		&user.ID, &user.Phone, &user.Email, &user.FullName, &user.AvatarURL,
		&user.Role, &user.Bio, &user.Languages,
		&user.XP, &user.Level, &user.IsVerified, &user.IsActive,
		&user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return user, err
}

func (r *UserRepository) GetByPhone(ctx context.Context, phone string) (*model.User, error) {
	candidates := phoneLookupCandidates(phone)
	if len(candidates) == 0 {
		return nil, nil
	}

	user := &model.User{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, phone, email, full_name, avatar_url, role, bio, languages,
			   xp, level, is_verified, is_active, last_login_at, created_at, updated_at
		FROM users
		WHERE phone = ANY($1) AND is_active = TRUE
		ORDER BY CASE WHEN phone = $2 THEN 0 ELSE 1 END
		LIMIT 1`, candidates, candidates[0],
	).Scan(
		&user.ID, &user.Phone, &user.Email, &user.FullName, &user.AvatarURL,
		&user.Role, &user.Bio, &user.Languages,
		&user.XP, &user.Level, &user.IsVerified, &user.IsActive,
		&user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return user, err
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	user := &model.User{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, phone, email, full_name, avatar_url, role, bio, languages,
			   xp, level, is_verified, is_active, last_login_at, created_at, updated_at
		FROM users WHERE LOWER(email) = LOWER($1) AND is_active = TRUE`, email,
	).Scan(
		&user.ID, &user.Phone, &user.Email, &user.FullName, &user.AvatarURL,
		&user.Role, &user.Bio, &user.Languages,
		&user.XP, &user.Level, &user.IsVerified, &user.IsActive,
		&user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return user, err
}

func (r *UserRepository) GetByGoogleID(ctx context.Context, googleID string) (*model.User, error) {
	user := &model.User{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, phone, email, full_name, avatar_url, role, bio, languages,
			   xp, level, is_verified, is_active, last_login_at, created_at, updated_at
		FROM users WHERE google_id = $1 AND is_active = TRUE`, googleID,
	).Scan(
		&user.ID, &user.Phone, &user.Email, &user.FullName, &user.AvatarURL,
		&user.Role, &user.Bio, &user.Languages,
		&user.XP, &user.Level, &user.IsVerified, &user.IsActive,
		&user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return user, err
}

func (r *UserRepository) CreateWithGoogle(ctx context.Context, googleID, email, name, avatarURL string) (*model.User, error) {
	user := &model.User{
		ID:         uuid.New(),
		Email:      &email,
		FullName:   name,
		AvatarURL:  &avatarURL,
		Role:       model.RoleTraveler,
		IsVerified: true,
		IsActive:   true,
		Level:      "Newbie",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO users (id, email, full_name, avatar_url, role, is_verified, is_active, level, google_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		user.ID, email, name, avatarURL, model.RoleTraveler,
		true, true, "Newbie", googleID, user.CreatedAt, user.UpdatedAt,
	)
	return user, err
}

func (r *UserRepository) LinkGoogleID(ctx context.Context, userID uuid.UUID, googleID, avatarURL string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE users
		SET google_id = $1,
		    avatar_url = CASE
		        WHEN $2 <> '' THEN COALESCE(avatar_url, $2)
		        ELSE avatar_url
		    END,
		    is_verified = TRUE,
		    updated_at = NOW()
		WHERE id = $3 AND is_active = TRUE`,
		googleID, avatarURL, userID,
	)
	return err
}

func (r *UserRepository) UpdateLastLogin(ctx context.Context, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE users SET last_login_at = NOW() WHERE id = $1`, userID)
	return err
}

func (r *UserRepository) AddXP(ctx context.Context, userID uuid.UUID, xp int) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE users SET xp = xp + $1, 
		level = CASE 
			WHEN xp + $1 >= 5000 THEN 'Master'
			WHEN xp + $1 >= 2000 THEN 'Expert'
			WHEN xp + $1 >= 500  THEN 'Explorer'
			WHEN xp + $1 >= 100  THEN 'Adventurer'
			ELSE 'Newbie'
		END
		WHERE id = $2`, xp, userID)
	return err
}

// UpdateProfile — cập nhật thông tin user
func (r *UserRepository) UpdateProfile(ctx context.Context, userID uuid.UUID, fullName string, email, bio, avatarURL *string, languages []string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE users SET full_name = $1, email = $2, bio = $3, avatar_url = $4, languages = $5, updated_at = NOW()
		WHERE id = $6 AND is_active = TRUE`,
		fullName, email, bio, avatarURL, languages, userID)
	return err
}

// ListUsers — danh sách users (admin)
func (r *UserRepository) ListUsers(ctx context.Context, search, role string, page, perPage int) ([]model.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 50 {
		perPage = 20
	}

	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, "TRUE")

	if search != "" {
		conditions = append(conditions, fmt.Sprintf(
			"(full_name ILIKE $%d OR phone ILIKE $%d OR email ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if role != "" {
		conditions = append(conditions, fmt.Sprintf("role = $%d", argIdx))
		args = append(args, role)
		argIdx++
	}

	where := strings.Join(conditions, " AND ")

	var total int64
	r.pool.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM users WHERE %s", where), args...).Scan(&total)

	offset := (page - 1) * perPage
	args = append(args, perPage, offset)

	query := fmt.Sprintf(`
		SELECT id, phone, email, full_name, avatar_url, role, bio, languages,
			   xp, level, is_verified, is_active, last_login_at, created_at, updated_at
		FROM users WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(
			&u.ID, &u.Phone, &u.Email, &u.FullName, &u.AvatarURL,
			&u.Role, &u.Bio, &u.Languages,
			&u.XP, &u.Level, &u.IsVerified, &u.IsActive,
			&u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, u)
	}
	return users, total, nil
}

// SetActive — ban/unban user (admin)
func (r *UserRepository) SetActive(ctx context.Context, userID uuid.UUID, active bool) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`, active, userID)
	return err
}

// SetRole — change user role (admin)
func (r *UserRepository) SetRole(ctx context.Context, userID uuid.UUID, role string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`, role, userID)
	return err
}
