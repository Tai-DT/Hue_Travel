package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================
// Gamification Repository
// ============================================

type Achievement struct {
	ID               uuid.UUID  `json:"id"`
	Slug             string     `json:"slug"`
	Title            string     `json:"title"`
	Description      string     `json:"description"`
	Icon             string     `json:"icon"`
	Category         string     `json:"category"`
	XPReward         int        `json:"xp_reward"`
	RequirementType  string     `json:"requirement_type"`
	RequirementCount int        `json:"requirement_count"`
	IsActive         bool       `json:"is_active"`
	Earned           bool       `json:"earned,omitempty"`
	EarnedAt         *time.Time `json:"earned_at,omitempty"`
}

type CheckIn struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	PlaceName string    `json:"place_name"`
	Lat       float64   `json:"lat"`
	Lng       float64   `json:"lng"`
	PhotoURL  *string   `json:"photo_url"`
	Note      *string   `json:"note"`
	XPEarned  int       `json:"xp_earned"`
	CreatedAt time.Time `json:"created_at"`
}

type LeaderboardEntry struct {
	Rank      int       `json:"rank"`
	UserID    uuid.UUID `json:"user_id"`
	FullName  string    `json:"full_name"`
	AvatarURL *string   `json:"avatar_url"`
	XP        int       `json:"xp"`
	Level     string    `json:"level"`
	Badges    int       `json:"badges"`
}

type GamificationRepository struct {
	pool *pgxpool.Pool
}

func NewGamificationRepository(pool *pgxpool.Pool) *GamificationRepository {
	return &GamificationRepository{pool: pool}
}

// ListAchievements — tất cả thành tựu (đánh dấu đã đạt cho user)
func (r *GamificationRepository) ListAchievements(ctx context.Context, userID *uuid.UUID) ([]Achievement, error) {
	var query string
	var args []interface{}

	if userID != nil {
		query = `
			SELECT a.id, a.slug, a.title, a.description, a.icon, a.category,
			       a.xp_reward, a.requirement_type, a.requirement_count, a.is_active,
			       (ua.id IS NOT NULL) as earned, ua.earned_at
			FROM achievements a
			LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = $1
			WHERE a.is_active = TRUE
			ORDER BY earned DESC, a.category, a.xp_reward ASC
		`
		args = []interface{}{*userID}
	} else {
		query = `
			SELECT a.id, a.slug, a.title, a.description, a.icon, a.category,
			       a.xp_reward, a.requirement_type, a.requirement_count, a.is_active,
			       FALSE, NULL
			FROM achievements a
			WHERE a.is_active = TRUE
			ORDER BY a.category, a.xp_reward ASC
		`
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var achievements []Achievement
	for rows.Next() {
		var a Achievement
		if err := rows.Scan(
			&a.ID, &a.Slug, &a.Title, &a.Description, &a.Icon, &a.Category,
			&a.XPReward, &a.RequirementType, &a.RequirementCount, &a.IsActive,
			&a.Earned, &a.EarnedAt,
		); err != nil {
			continue
		}
		achievements = append(achievements, a)
	}
	return achievements, nil
}

// GetUserAchievements — thành tựu đã đạt
func (r *GamificationRepository) GetUserAchievements(ctx context.Context, userID uuid.UUID) ([]Achievement, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT a.id, a.slug, a.title, a.description, a.icon, a.category,
		       a.xp_reward, a.requirement_type, a.requirement_count, a.is_active,
		       TRUE, ua.earned_at
		FROM user_achievements ua
		JOIN achievements a ON a.id = ua.achievement_id
		WHERE ua.user_id = $1
		ORDER BY ua.earned_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var achievements []Achievement
	for rows.Next() {
		var a Achievement
		if err := rows.Scan(
			&a.ID, &a.Slug, &a.Title, &a.Description, &a.Icon, &a.Category,
			&a.XPReward, &a.RequirementType, &a.RequirementCount, &a.IsActive,
			&a.Earned, &a.EarnedAt,
		); err != nil {
			continue
		}
		achievements = append(achievements, a)
	}
	return achievements, nil
}

// AwardAchievement — trao thành tựu cho user
func (r *GamificationRepository) AwardAchievement(ctx context.Context, userID, achievementID uuid.UUID) (bool, error) {
	// Check if already earned
	var exists bool
	r.pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM user_achievements WHERE user_id = $1 AND achievement_id = $2)
	`, userID, achievementID).Scan(&exists)
	if exists {
		return false, nil
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO user_achievements (user_id, achievement_id)
		VALUES ($1, $2) ON CONFLICT DO NOTHING
	`, userID, achievementID)
	if err != nil {
		return false, err
	}

	// Award XP
	var xpReward int
	r.pool.QueryRow(ctx, `SELECT xp_reward FROM achievements WHERE id = $1`, achievementID).Scan(&xpReward)
	if xpReward > 0 {
		r.AddXP(ctx, userID, xpReward)
	}

	return true, nil
}

// AddXP — thêm XP và cập nhật level
func (r *GamificationRepository) AddXP(ctx context.Context, userID uuid.UUID, xp int) {
	_, _ = r.pool.Exec(ctx, `
		UPDATE users SET 
			xp = xp + $2,
			level = CASE
				WHEN xp + $2 >= 5000 THEN 'Legend'
				WHEN xp + $2 >= 2000 THEN 'Expert'
				WHEN xp + $2 >= 1000 THEN 'Advanced'
				WHEN xp + $2 >= 500  THEN 'Intermediate'
				WHEN xp + $2 >= 100  THEN 'Explorer'
				ELSE 'Newbie'
			END
		WHERE id = $1
	`, userID, xp)
}

// CheckIn — check-in tại địa điểm
func (r *GamificationRepository) CheckIn(ctx context.Context, ci *CheckIn) error {
	ci.ID = uuid.New()
	ci.XPEarned = 10
	ci.CreatedAt = time.Now()

	_, err := r.pool.Exec(ctx, `
		INSERT INTO checkins (id, user_id, place_name, lat, lng, photo_url, note, xp_earned, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, ci.ID, ci.UserID, ci.PlaceName, ci.Lat, ci.Lng, ci.PhotoURL, ci.Note, ci.XPEarned, ci.CreatedAt)
	if err != nil {
		return err
	}

	// Award XP for check-in
	r.AddXP(ctx, ci.UserID, ci.XPEarned)

	return nil
}

// GetCheckins — lịch sử check-in
func (r *GamificationRepository) GetCheckins(ctx context.Context, userID uuid.UUID, limit int) ([]CheckIn, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, place_name, lat, lng, photo_url, note, xp_earned, created_at
		FROM checkins WHERE user_id = $1
		ORDER BY created_at DESC LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var checkins []CheckIn
	for rows.Next() {
		var ci CheckIn
		if err := rows.Scan(&ci.ID, &ci.UserID, &ci.PlaceName, &ci.Lat, &ci.Lng,
			&ci.PhotoURL, &ci.Note, &ci.XPEarned, &ci.CreatedAt); err != nil {
			continue
		}
		checkins = append(checkins, ci)
	}
	return checkins, nil
}

// GetLeaderboard — bảng xếp hạng
func (r *GamificationRepository) GetLeaderboard(ctx context.Context, limit int) ([]LeaderboardEntry, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	rows, err := r.pool.Query(ctx, `
		SELECT u.id, u.full_name, u.avatar_url, u.xp, u.level,
		       (SELECT COUNT(*) FROM user_achievements ua WHERE ua.user_id = u.id) as badges
		FROM users u
		WHERE u.is_active = TRUE AND u.xp > 0
		ORDER BY u.xp DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []LeaderboardEntry
	rank := 0
	for rows.Next() {
		rank++
		var e LeaderboardEntry
		if err := rows.Scan(&e.UserID, &e.FullName, &e.AvatarURL, &e.XP, &e.Level, &e.Badges); err != nil {
			continue
		}
		e.Rank = rank
		entries = append(entries, e)
	}
	return entries, nil
}

// GetUserStats — thống kê gamification của user
func (r *GamificationRepository) GetUserStats(ctx context.Context, userID uuid.UUID) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	var xp int
	var level string
	r.pool.QueryRow(ctx, `SELECT xp, level FROM users WHERE id = $1`, userID).Scan(&xp, &level)
	stats["xp"] = xp
	stats["level"] = level

	var badges int
	r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM user_achievements WHERE user_id = $1`, userID).Scan(&badges)
	stats["badges"] = badges

	var checkins int
	r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM checkins WHERE user_id = $1`, userID).Scan(&checkins)
	stats["checkins"] = checkins

	// Next level info
	nextLevelXP := 100
	switch {
	case xp >= 5000:
		nextLevelXP = 0 // max level
	case xp >= 2000:
		nextLevelXP = 5000
	case xp >= 1000:
		nextLevelXP = 2000
	case xp >= 500:
		nextLevelXP = 1000
	case xp >= 100:
		nextLevelXP = 500
	}
	stats["next_level_xp"] = nextLevelXP
	if nextLevelXP > 0 {
		stats["progress"] = float64(xp) / float64(nextLevelXP) * 100
	} else {
		stats["progress"] = 100
	}

	// Rank
	var rank int
	r.pool.QueryRow(ctx, `
		SELECT COUNT(*) + 1 FROM users WHERE xp > (SELECT xp FROM users WHERE id = $1) AND is_active = TRUE
	`, userID).Scan(&rank)
	stats["rank"] = rank

	return stats, nil
}
