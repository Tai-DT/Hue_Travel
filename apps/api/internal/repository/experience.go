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
// Experience Repository
// ============================================

type ExperienceRepository struct {
	pool *pgxpool.Pool
}

func NewExperienceRepository(pool *pgxpool.Pool) *ExperienceRepository {
	return &ExperienceRepository{pool: pool}
}

type ExperienceFilter struct {
	Category        string
	MinPrice        int64
	MaxPrice        int64
	GuideID         *uuid.UUID
	Search          string
	Page            int
	PerPage         int
	SortBy          string // "rating", "price_asc", "price_desc", "newest"
	IncludeInactive bool   // admin: include soft-deleted experiences
}

func (r *ExperienceRepository) List(ctx context.Context, filter ExperienceFilter) ([]model.Experience, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PerPage < 1 || filter.PerPage > 50 {
		filter.PerPage = 20
	}

	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, "TRUE")

	if !filter.IncludeInactive {
		conditions = append(conditions, "e.is_active = TRUE")
	}

	if filter.Category != "" {
		conditions = append(conditions, fmt.Sprintf("e.category = $%d", argIdx))
		args = append(args, filter.Category)
		argIdx++
	}
	if filter.MinPrice > 0 {
		conditions = append(conditions, fmt.Sprintf("e.price >= $%d", argIdx))
		args = append(args, filter.MinPrice)
		argIdx++
	}
	if filter.MaxPrice > 0 {
		conditions = append(conditions, fmt.Sprintf("e.price <= $%d", argIdx))
		args = append(args, filter.MaxPrice)
		argIdx++
	}
	if filter.GuideID != nil {
		conditions = append(conditions, fmt.Sprintf("e.guide_id = $%d", argIdx))
		args = append(args, *filter.GuideID)
		argIdx++
	}
	if filter.Search != "" {
		conditions = append(conditions, fmt.Sprintf(
			"(e.title ILIKE '%%' || $%d || '%%' OR e.description ILIKE '%%' || $%d || '%%')",
			argIdx, argIdx))
		args = append(args, filter.Search)
		argIdx++
	}

	where := strings.Join(conditions, " AND ")

	orderBy := "e.rating DESC, e.rating_count DESC"
	switch filter.SortBy {
	case "price_asc":
		orderBy = "e.price ASC"
	case "price_desc":
		orderBy = "e.price DESC"
	case "newest":
		orderBy = "e.created_at DESC"
	}

	// Count total
	var total int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM experiences e WHERE %s", where)
	r.pool.QueryRow(ctx, countQuery, args...).Scan(&total)

	// Fetch with guide info
	offset := (filter.Page - 1) * filter.PerPage
	args = append(args, filter.PerPage, offset)

	query := fmt.Sprintf(`
		SELECT e.id, e.guide_id, e.title, e.description, e.category, e.price, 
			   e.max_guests, e.duration_mins, e.meeting_point, e.meeting_lat, e.meeting_lng,
			   e.includes, e.highlights, e.image_urls, e.rating, e.rating_count, 
			   e.is_instant, e.is_active, e.created_at, e.updated_at,
			   u.id, u.full_name, u.avatar_url, u.role
		FROM experiences e
		JOIN users u ON e.guide_id = u.id
		WHERE %s
		ORDER BY %s
		LIMIT $%d OFFSET $%d`,
		where, orderBy, argIdx, argIdx+1)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var experiences []model.Experience
	for rows.Next() {
		var exp model.Experience
		var guide model.User
		if err := rows.Scan(
			&exp.ID, &exp.GuideID, &exp.Title, &exp.Description, &exp.Category,
			&exp.Price, &exp.MaxGuests, &exp.DurationMins,
			&exp.MeetingPoint, &exp.MeetingLat, &exp.MeetingLng,
			&exp.Includes, &exp.Highlights, &exp.ImageURLs,
			&exp.Rating, &exp.RatingCount, &exp.IsInstant, &exp.IsActive,
			&exp.CreatedAt, &exp.UpdatedAt,
			&guide.ID, &guide.FullName, &guide.AvatarURL, &guide.Role,
		); err != nil {
			return nil, 0, fmt.Errorf("scan experience: %w", err)
		}
		exp.Guide = &guide
		experiences = append(experiences, exp)
	}

	return experiences, total, nil
}

func (r *ExperienceRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Experience, error) {
	exp := &model.Experience{}
	guide := &model.User{}

	err := r.pool.QueryRow(ctx, `
		SELECT e.id, e.guide_id, e.title, e.description, e.category, e.price,
			   e.max_guests, e.duration_mins, e.meeting_point, e.meeting_lat, e.meeting_lng,
			   e.includes, e.highlights, e.image_urls, e.rating, e.rating_count,
			   e.is_instant, e.is_active, e.created_at, e.updated_at,
			   u.id, u.full_name, u.avatar_url, u.role, u.bio
		FROM experiences e
		JOIN users u ON e.guide_id = u.id
		WHERE e.id = $1 AND e.is_active = TRUE`, id,
	).Scan(
		&exp.ID, &exp.GuideID, &exp.Title, &exp.Description, &exp.Category,
		&exp.Price, &exp.MaxGuests, &exp.DurationMins,
		&exp.MeetingPoint, &exp.MeetingLat, &exp.MeetingLng,
		&exp.Includes, &exp.Highlights, &exp.ImageURLs,
		&exp.Rating, &exp.RatingCount, &exp.IsInstant, &exp.IsActive,
		&exp.CreatedAt, &exp.UpdatedAt,
		&guide.ID, &guide.FullName, &guide.AvatarURL, &guide.Role, &guide.Bio,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	exp.Guide = guide
	return exp, err
}

func (r *ExperienceRepository) Create(ctx context.Context, exp *model.Experience) error {
	exp.ID = uuid.New()
	exp.CreatedAt = time.Now()
	exp.UpdatedAt = time.Now()

	_, err := r.pool.Exec(ctx, `
		INSERT INTO experiences (id, guide_id, title, slug, description, category, price,
			max_guests, duration_mins, meeting_point, meeting_lat, meeting_lng,
			includes, highlights, image_urls, is_instant, cancel_policy, is_active, published_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
		exp.ID, exp.GuideID, exp.Title, generateSlug(exp.Title),
		exp.Description, exp.Category, exp.Price,
		exp.MaxGuests, exp.DurationMins, exp.MeetingPoint, exp.MeetingLat, exp.MeetingLng,
		exp.Includes, exp.Highlights, exp.ImageURLs,
		exp.IsInstant, "flexible", true, time.Now(),
		exp.CreatedAt, exp.UpdatedAt,
	)
	return err
}

func (r *ExperienceRepository) Update(ctx context.Context, exp *model.Experience) error {
	exp.UpdatedAt = time.Now()

	_, err := r.pool.Exec(ctx, `
		UPDATE experiences SET
			title = $1, description = $2, category = $3, price = $4,
			max_guests = $5, duration_mins = $6, meeting_point = $7,
			meeting_lat = $8, meeting_lng = $9, includes = $10,
			highlights = $11, image_urls = $12, is_instant = $13,
			is_active = $14, updated_at = $15
		WHERE id = $16`,
		exp.Title, exp.Description, exp.Category, exp.Price,
		exp.MaxGuests, exp.DurationMins, exp.MeetingPoint,
		exp.MeetingLat, exp.MeetingLng, exp.Includes,
		exp.Highlights, exp.ImageURLs, exp.IsInstant,
		exp.IsActive, exp.UpdatedAt, exp.ID,
	)
	return err
}

// SoftDelete — vô hiệu hoá experience (set is_active = false)
func (r *ExperienceRepository) SoftDelete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE experiences SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, id)
	return err
}

// GetOwnerID — lấy guide_id sở hữu experience
func (r *ExperienceRepository) GetOwnerID(ctx context.Context, id uuid.UUID) (uuid.UUID, error) {
	var ownerID uuid.UUID
	err := r.pool.QueryRow(ctx, `SELECT guide_id FROM experiences WHERE id = $1`, id).Scan(&ownerID)
	return ownerID, err
}
