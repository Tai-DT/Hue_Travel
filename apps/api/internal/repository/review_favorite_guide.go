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
// Review Repository
// ============================================

type ReviewRepository struct {
	pool *pgxpool.Pool
}

func NewReviewRepository(pool *pgxpool.Pool) *ReviewRepository {
	return &ReviewRepository{pool: pool}
}

func (r *ReviewRepository) Create(ctx context.Context, review *model.Review) error {
	review.ID = uuid.New()
	review.CreatedAt = time.Now()
	review.UpdatedAt = time.Now()

	_, err := r.pool.Exec(ctx, `
		INSERT INTO reviews (id, traveler_id, experience_id, booking_id,
			overall_rating, guide_rating, value_rating, 
			comment, photo_urls, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		review.ID, review.TravelerID, review.ExperienceID, review.BookingID,
		review.OverallRating, review.GuideRating, review.ValueRating,
		review.Comment, review.PhotoURLs,
		review.CreatedAt, review.UpdatedAt,
	)
	if err != nil {
		return err
	}

	// Update experience average rating
	_, err = r.pool.Exec(ctx, `
		UPDATE experiences SET
			rating = (SELECT ROUND(AVG(overall_rating)::numeric, 1) FROM reviews WHERE experience_id = $1),
			rating_count = (SELECT COUNT(*) FROM reviews WHERE experience_id = $1),
			updated_at = NOW()
		WHERE id = $1`, review.ExperienceID)

	return err
}

func (r *ReviewRepository) ListByExperience(ctx context.Context, experienceID uuid.UUID, page, perPage int) ([]model.Review, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 50 {
		perPage = 10
	}

	var total int64
	r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM reviews WHERE experience_id = $1`, experienceID,
	).Scan(&total)

	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx, `
		SELECT r.id, r.traveler_id, r.experience_id, r.booking_id,
			   r.overall_rating, r.guide_rating, r.value_rating,
			   r.comment, r.photo_urls, r.is_featured,
			   r.created_at, r.updated_at,
			   u.full_name, u.avatar_url, u.level
		FROM reviews r
		JOIN users u ON r.traveler_id = u.id
		WHERE r.experience_id = $1
		ORDER BY r.is_featured DESC, r.created_at DESC
		LIMIT $2 OFFSET $3`, experienceID, perPage, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var reviews []model.Review
	for rows.Next() {
		var rv model.Review
		var reviewer model.User
		err := rows.Scan(
			&rv.ID, &rv.TravelerID, &rv.ExperienceID, &rv.BookingID,
			&rv.OverallRating, &rv.GuideRating, &rv.ValueRating,
			&rv.Comment, &rv.PhotoURLs, &rv.IsFeatured,
			&rv.CreatedAt, &rv.UpdatedAt,
			&reviewer.FullName, &reviewer.AvatarURL, &reviewer.Level,
		)
		if err != nil {
			return nil, 0, err
		}
		rv.Traveler = &reviewer
		reviews = append(reviews, rv)
	}

	return reviews, total, nil
}

func (r *ReviewRepository) GetReviewSummary(ctx context.Context, experienceID uuid.UUID) (*ReviewSummary, error) {
	summary := &ReviewSummary{}

	err := r.pool.QueryRow(ctx, `
		SELECT 
			COUNT(*),
			COALESCE(ROUND(AVG(overall_rating)::numeric, 1), 0),
			COALESCE(ROUND(AVG(guide_rating)::numeric, 1), 0),
			COALESCE(ROUND(AVG(value_rating)::numeric, 1), 0),
			COUNT(*) FILTER (WHERE overall_rating = 5),
			COUNT(*) FILTER (WHERE overall_rating = 4),
			COUNT(*) FILTER (WHERE overall_rating = 3),
			COUNT(*) FILTER (WHERE overall_rating = 2),
			COUNT(*) FILTER (WHERE overall_rating = 1)
		FROM reviews WHERE experience_id = $1`, experienceID,
	).Scan(
		&summary.TotalReviews,
		&summary.AverageOverall,
		&summary.AverageGuide,
		&summary.AverageValue,
		&summary.Star5, &summary.Star4, &summary.Star3, &summary.Star2, &summary.Star1,
	)
	if err == pgx.ErrNoRows {
		return summary, nil
	}
	return summary, err
}

type ReviewSummary struct {
	TotalReviews   int64   `json:"total_reviews"`
	AverageOverall float64 `json:"average_overall"`
	AverageGuide   float64 `json:"average_guide"`
	AverageValue   float64 `json:"average_value"`
	Star5          int64   `json:"star_5"`
	Star4          int64   `json:"star_4"`
	Star3          int64   `json:"star_3"`
	Star2          int64   `json:"star_2"`
	Star1          int64   `json:"star_1"`
}

// ============================================
// Favorite Repository
// ============================================

type FavoriteRepository struct {
	pool *pgxpool.Pool
}

func NewFavoriteRepository(pool *pgxpool.Pool) *FavoriteRepository {
	return &FavoriteRepository{pool: pool}
}

func (r *FavoriteRepository) Toggle(ctx context.Context, userID, experienceID uuid.UUID) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM favorites WHERE user_id = $1 AND experience_id = $2)`,
		userID, experienceID,
	).Scan(&exists)
	if err != nil {
		return false, err
	}

	if exists {
		_, err = r.pool.Exec(ctx,
			`DELETE FROM favorites WHERE user_id = $1 AND experience_id = $2`,
			userID, experienceID)
		return false, err
	}

	_, err = r.pool.Exec(ctx, `
		INSERT INTO favorites (id, user_id, experience_id, created_at)
		VALUES ($1, $2, $3, NOW())`,
		uuid.New(), userID, experienceID)
	return true, err
}

func (r *FavoriteRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]model.Experience, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT e.id, e.title, e.category, e.price, e.duration_mins,
			   e.image_urls, e.rating, e.rating_count, e.is_instant
		FROM favorites f
		JOIN experiences e ON f.experience_id = e.id
		WHERE f.user_id = $1
		ORDER BY f.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var experiences []model.Experience
	for rows.Next() {
		var exp model.Experience
		err := rows.Scan(
			&exp.ID, &exp.Title, &exp.Category, &exp.Price, &exp.DurationMins,
			&exp.ImageURLs, &exp.Rating, &exp.RatingCount, &exp.IsInstant,
		)
		if err != nil {
			return nil, err
		}
		experiences = append(experiences, exp)
	}
	return experiences, nil
}

func (r *FavoriteRepository) IsFavorited(ctx context.Context, userID, experienceID uuid.UUID) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM favorites WHERE user_id = $1 AND experience_id = $2)`,
		userID, experienceID,
	).Scan(&exists)
	return exists, err
}

// ============================================
// Guide Profile Repository
// ============================================

type GuideProfileRepository struct {
	pool *pgxpool.Pool
}

func NewGuideProfileRepository(pool *pgxpool.Pool) *GuideProfileRepository {
	return &GuideProfileRepository{pool: pool}
}

func (r *GuideProfileRepository) GetByUserID(ctx context.Context, userID uuid.UUID) (*model.GuideProfile, error) {
	gp := &model.GuideProfile{}
	user := &model.User{}

	err := r.pool.QueryRow(ctx, `
		SELECT g.id, g.user_id, g.badge_level, g.specialties, g.experience_years,
			   g.total_tours, g.total_reviews, g.avg_rating, g.response_time_mins,
			   g.acceptance_rate, g.is_approved, g.created_at,
			   u.full_name, u.avatar_url, u.bio, u.languages
		FROM guide_profiles g
		JOIN users u ON g.user_id = u.id
		WHERE g.user_id = $1`, userID,
	).Scan(
		&gp.ID, &gp.UserID, &gp.BadgeLevel, &gp.Specialties, &gp.ExperienceYears,
		&gp.TotalTours, &gp.TotalReviews, &gp.AvgRating, &gp.ResponseTimeMins,
		&gp.AcceptanceRate, &gp.IsApproved, &gp.CreatedAt,
		&user.FullName, &user.AvatarURL, &user.Bio, &user.Languages,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	gp.User = user
	return gp, err
}

func (r *GuideProfileRepository) GetTopGuides(ctx context.Context, limit int) ([]model.GuideProfile, error) {
	if limit < 1 || limit > 20 {
		limit = 10
	}

	rows, err := r.pool.Query(ctx, `
		SELECT g.id, g.user_id, g.badge_level, g.specialties, g.total_tours,
			   g.total_reviews, g.avg_rating, g.response_time_mins,
			   u.full_name, u.avatar_url, u.bio
		FROM guide_profiles g
		JOIN users u ON g.user_id = u.id
		WHERE g.is_approved = TRUE
		ORDER BY g.avg_rating DESC, g.total_reviews DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var guides []model.GuideProfile
	for rows.Next() {
		var gp model.GuideProfile
		var user model.User
		err := rows.Scan(
			&gp.ID, &gp.UserID, &gp.BadgeLevel, &gp.Specialties,
			&gp.TotalTours, &gp.TotalReviews, &gp.AvgRating, &gp.ResponseTimeMins,
			&user.FullName, &user.AvatarURL, &user.Bio,
		)
		if err != nil {
			return nil, err
		}
		gp.User = &user
		guides = append(guides, gp)
	}
	return guides, nil
}
