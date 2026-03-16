package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================
// Report & Block Repository
// ============================================

type Report struct {
	ID          uuid.UUID  `json:"id"`
	ReporterID  uuid.UUID  `json:"reporter_id"`
	TargetType  string     `json:"target_type"`
	TargetID    uuid.UUID  `json:"target_id"`
	Reason      string     `json:"reason"`
	Description *string    `json:"description"`
	Status      string     `json:"status"`
	AdminNote   *string    `json:"admin_note,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type BlockedUser struct {
	ID        uuid.UUID `json:"id"`
	BlockerID uuid.UUID `json:"blocker_id"`
	BlockedID uuid.UUID `json:"blocked_id"`
	CreatedAt time.Time `json:"created_at"`
}

type ReportBlockRepository struct {
	pool *pgxpool.Pool
}

func NewReportBlockRepository(pool *pgxpool.Pool) *ReportBlockRepository {
	return &ReportBlockRepository{pool: pool}
}

func (r *ReportBlockRepository) CreateReport(ctx context.Context, report *Report) error {
	report.ID = uuid.New()
	report.Status = "pending"
	report.CreatedAt = time.Now()
	_, err := r.pool.Exec(ctx, `
		INSERT INTO reports (id, reporter_id, target_type, target_id, reason, description, status, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
	`, report.ID, report.ReporterID, report.TargetType, report.TargetID,
		report.Reason, report.Description, report.Status, report.CreatedAt)
	return err
}

func (r *ReportBlockRepository) ListReports(ctx context.Context, status string) ([]Report, error) {
	query := `SELECT id, reporter_id, target_type, target_id, reason, description, status, admin_note, created_at
		FROM reports`
	args := []interface{}{}
	if status != "" {
		query += " WHERE status = $1"
		args = append(args, status)
	}
	query += " ORDER BY created_at DESC LIMIT 50"
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var reports []Report
	for rows.Next() {
		var rp Report
		if err := rows.Scan(&rp.ID, &rp.ReporterID, &rp.TargetType, &rp.TargetID,
			&rp.Reason, &rp.Description, &rp.Status, &rp.AdminNote, &rp.CreatedAt); err != nil {
			continue
		}
		reports = append(reports, rp)
	}
	return reports, nil
}

func (r *ReportBlockRepository) BlockUser(ctx context.Context, blockerID, blockedID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO blocked_users (blocker_id, blocked_id, created_at) VALUES ($1,$2,NOW())
		ON CONFLICT DO NOTHING
	`, blockerID, blockedID)
	return err
}

func (r *ReportBlockRepository) UnblockUser(ctx context.Context, blockerID, blockedID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2`,
		blockerID, blockedID)
	return err
}

func (r *ReportBlockRepository) ListBlocked(ctx context.Context, userID uuid.UUID) ([]BlockedUser, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, blocker_id, blocked_id, created_at FROM blocked_users WHERE blocker_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var blocked []BlockedUser
	for rows.Next() {
		var b BlockedUser
		if err := rows.Scan(&b.ID, &b.BlockerID, &b.BlockedID, &b.CreatedAt); err != nil {
			continue
		}
		blocked = append(blocked, b)
	}
	return blocked, nil
}

func (r *ReportBlockRepository) IsBlocked(ctx context.Context, userA, userB uuid.UUID) bool {
	var count int
	r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM blocked_users
		WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
	`, userA, userB).Scan(&count)
	return count > 0
}

// ============================================
// Guide Application Repository
// ============================================

type GuideApplication struct {
	ID              uuid.UUID  `json:"id"`
	UserID          uuid.UUID  `json:"user_id"`
	FullName        string     `json:"full_name"`
	Phone           string     `json:"phone"`
	Email           *string    `json:"email"`
	Specialties     []string   `json:"specialties"`
	ExperienceYears int        `json:"experience_years"`
	Languages       []string   `json:"languages"`
	Bio             *string    `json:"bio"`
	IDCardURL       *string    `json:"id_card_url"`
	CertificateURLs []string   `json:"certificate_urls"`
	Status          string     `json:"status"`
	AdminNote       *string    `json:"admin_note,omitempty"`
	ReviewedAt      *time.Time `json:"reviewed_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

type GuideAppRepository struct {
	pool *pgxpool.Pool
}

func NewGuideAppRepository(pool *pgxpool.Pool) *GuideAppRepository {
	return &GuideAppRepository{pool: pool}
}

func (r *GuideAppRepository) Create(ctx context.Context, app *GuideApplication) error {
	app.ID = uuid.New()
	app.Status = "pending"
	app.CreatedAt = time.Now()
	_, err := r.pool.Exec(ctx, `
		INSERT INTO guide_applications (id, user_id, full_name, phone, email, specialties,
			experience_years, languages, bio, id_card_url, certificate_urls, status, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
	`, app.ID, app.UserID, app.FullName, app.Phone, app.Email, app.Specialties,
		app.ExperienceYears, app.Languages, app.Bio, app.IDCardURL, app.CertificateURLs,
		app.Status, app.CreatedAt)
	return err
}

func (r *GuideAppRepository) ListPending(ctx context.Context) ([]GuideApplication, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, full_name, phone, email, specialties, experience_years,
			languages, bio, status, created_at
		FROM guide_applications WHERE status = 'pending'
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var apps []GuideApplication
	for rows.Next() {
		var a GuideApplication
		if err := rows.Scan(&a.ID, &a.UserID, &a.FullName, &a.Phone, &a.Email,
			&a.Specialties, &a.ExperienceYears, &a.Languages, &a.Bio, &a.Status, &a.CreatedAt); err != nil {
			continue
		}
		apps = append(apps, a)
	}
	return apps, nil
}

func (r *GuideAppRepository) GetMyApplication(ctx context.Context, userID uuid.UUID) (*GuideApplication, error) {
	var a GuideApplication
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, full_name, phone, email, specialties, experience_years,
			languages, bio, status, admin_note, reviewed_at, created_at
		FROM guide_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
	`, userID).Scan(&a.ID, &a.UserID, &a.FullName, &a.Phone, &a.Email,
		&a.Specialties, &a.ExperienceYears, &a.Languages, &a.Bio,
		&a.Status, &a.AdminNote, &a.ReviewedAt, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *GuideAppRepository) Approve(ctx context.Context, appID uuid.UUID, note string) error {
	now := time.Now()
	_, err := r.pool.Exec(ctx, `
		UPDATE guide_applications SET status = 'approved', admin_note = $2, reviewed_at = $3
		WHERE id = $1
	`, appID, note, now)
	return err
}

func (r *GuideAppRepository) Reject(ctx context.Context, appID uuid.UUID, note string) error {
	now := time.Now()
	_, err := r.pool.Exec(ctx, `
		UPDATE guide_applications SET status = 'rejected', admin_note = $2, reviewed_at = $3
		WHERE id = $1
	`, appID, note, now)
	return err
}

// ============================================
// Story Repository (Travel Feed)
// ============================================

type Story struct {
	ID           uuid.UUID  `json:"id"`
	AuthorID     uuid.UUID  `json:"author_id"`
	AuthorName   string     `json:"author_name,omitempty"`
	AuthorAvatar *string    `json:"author_avatar,omitempty"`
	Content      *string    `json:"content"`
	MediaURLs    []string   `json:"media_urls"`
	MediaType    string     `json:"media_type"`
	LocationName *string    `json:"location_name"`
	Lat          *float64   `json:"lat,omitempty"`
	Lng          *float64   `json:"lng,omitempty"`
	ExperienceID *uuid.UUID `json:"experience_id,omitempty"`
	LikeCount    int        `json:"like_count"`
	CommentCount int        `json:"comment_count"`
	IsLiked      bool       `json:"is_liked"`
	CreatedAt    time.Time  `json:"created_at"`
}

type StoryComment struct {
	ID         uuid.UUID `json:"id"`
	StoryID    uuid.UUID `json:"story_id"`
	UserID     uuid.UUID `json:"user_id"`
	UserName   string    `json:"user_name,omitempty"`
	UserAvatar *string   `json:"user_avatar,omitempty"`
	Content    string    `json:"content"`
	CreatedAt  time.Time `json:"created_at"`
}

type StoryRepository struct {
	pool *pgxpool.Pool
}

func NewStoryRepository(pool *pgxpool.Pool) *StoryRepository {
	return &StoryRepository{pool: pool}
}

func (r *StoryRepository) Create(ctx context.Context, s *Story) error {
	s.ID = uuid.New()
	s.CreatedAt = time.Now()
	if s.MediaType == "" {
		s.MediaType = "image"
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO stories (id, author_id, content, media_urls, media_type,
			location_name, lat, lng, experience_id, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
	`, s.ID, s.AuthorID, s.Content, s.MediaURLs, s.MediaType,
		s.LocationName, s.Lat, s.Lng, s.ExperienceID, s.CreatedAt)
	return err
}

func (r *StoryRepository) Feed(ctx context.Context, viewerID uuid.UUID, limit, offset int) ([]Story, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := r.pool.Query(ctx, `
		SELECT s.id, s.author_id, u.full_name, u.avatar_url, s.content,
			s.media_urls, s.media_type, s.location_name, s.lat, s.lng,
			s.experience_id, s.like_count, s.comment_count,
			EXISTS(SELECT 1 FROM story_likes sl WHERE sl.story_id = s.id AND sl.user_id = $1) as is_liked,
			s.created_at
		FROM stories s
		JOIN users u ON u.id = s.author_id
		WHERE s.is_active = TRUE
		  AND s.author_id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = $1)
		ORDER BY s.created_at DESC
		LIMIT $2 OFFSET $3
	`, viewerID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var stories []Story
	for rows.Next() {
		var s Story
		if err := rows.Scan(&s.ID, &s.AuthorID, &s.AuthorName, &s.AuthorAvatar,
			&s.Content, &s.MediaURLs, &s.MediaType, &s.LocationName, &s.Lat, &s.Lng,
			&s.ExperienceID, &s.LikeCount, &s.CommentCount, &s.IsLiked, &s.CreatedAt); err != nil {
			continue
		}
		stories = append(stories, s)
	}
	return stories, nil
}

func (r *StoryRepository) ToggleLike(ctx context.Context, storyID, userID uuid.UUID) (bool, error) {
	var exists bool
	r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM story_likes WHERE story_id=$1 AND user_id=$2)`,
		storyID, userID).Scan(&exists)

	if exists {
		r.pool.Exec(ctx, `DELETE FROM story_likes WHERE story_id=$1 AND user_id=$2`, storyID, userID)
		r.pool.Exec(ctx, `UPDATE stories SET like_count = GREATEST(like_count-1,0) WHERE id=$1`, storyID)
		return false, nil
	}
	r.pool.Exec(ctx, `INSERT INTO story_likes (story_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, storyID, userID)
	r.pool.Exec(ctx, `UPDATE stories SET like_count = like_count+1 WHERE id=$1`, storyID)
	return true, nil
}

func (r *StoryRepository) AddComment(ctx context.Context, c *StoryComment) error {
	c.ID = uuid.New()
	c.CreatedAt = time.Now()
	_, err := r.pool.Exec(ctx, `
		INSERT INTO story_comments (id, story_id, user_id, content, created_at)
		VALUES ($1,$2,$3,$4,$5)
	`, c.ID, c.StoryID, c.UserID, c.Content, c.CreatedAt)
	if err == nil {
		r.pool.Exec(ctx, `UPDATE stories SET comment_count = comment_count+1 WHERE id=$1`, c.StoryID)
	}
	return err
}

func (r *StoryRepository) ListComments(ctx context.Context, storyID uuid.UUID) ([]StoryComment, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT sc.id, sc.story_id, sc.user_id, u.full_name, u.avatar_url, sc.content, sc.created_at
		FROM story_comments sc JOIN users u ON u.id = sc.user_id
		WHERE sc.story_id = $1 ORDER BY sc.created_at ASC
	`, storyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var comments []StoryComment
	for rows.Next() {
		var c StoryComment
		if err := rows.Scan(&c.ID, &c.StoryID, &c.UserID, &c.UserName, &c.UserAvatar, &c.Content, &c.CreatedAt); err != nil {
			continue
		}
		comments = append(comments, c)
	}
	return comments, nil
}

func (r *StoryRepository) Delete(ctx context.Context, storyID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `UPDATE stories SET is_active = FALSE WHERE id=$1 AND author_id=$2`, storyID, userID)
	return err
}

// ============================================
// Collection Repository (Bookmarks)
// ============================================

type Collection struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	CoverImage  *string   `json:"cover_image"`
	IsPublic    bool      `json:"is_public"`
	ItemCount   int       `json:"item_count"`
	CreatedAt   time.Time `json:"created_at"`
}

type CollectionItem struct {
	ID           uuid.UUID `json:"id"`
	CollectionID uuid.UUID `json:"collection_id"`
	ItemType     string    `json:"item_type"`
	ItemID       uuid.UUID `json:"item_id"`
	Note         *string   `json:"note"`
	AddedAt      time.Time `json:"added_at"`
}

type CollectionRepository struct {
	pool *pgxpool.Pool
}

func NewCollectionRepository(pool *pgxpool.Pool) *CollectionRepository {
	return &CollectionRepository{pool: pool}
}

func (r *CollectionRepository) Create(ctx context.Context, c *Collection) error {
	c.ID = uuid.New()
	c.CreatedAt = time.Now()
	_, err := r.pool.Exec(ctx, `
		INSERT INTO collections (id, user_id, name, description, cover_image, is_public, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
	`, c.ID, c.UserID, c.Name, c.Description, c.CoverImage, c.IsPublic, c.CreatedAt)
	return err
}

func (r *CollectionRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]Collection, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, name, description, cover_image, is_public, item_count, created_at
		FROM collections WHERE user_id = $1 ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var cols []Collection
	for rows.Next() {
		var c Collection
		if err := rows.Scan(&c.ID, &c.UserID, &c.Name, &c.Description,
			&c.CoverImage, &c.IsPublic, &c.ItemCount, &c.CreatedAt); err != nil {
			continue
		}
		cols = append(cols, c)
	}
	return cols, nil
}

func (r *CollectionRepository) AddItem(ctx context.Context, item *CollectionItem) error {
	item.ID = uuid.New()
	item.AddedAt = time.Now()
	_, err := r.pool.Exec(ctx, `
		INSERT INTO collection_items (id, collection_id, item_type, item_id, note, added_at)
		VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING
	`, item.ID, item.CollectionID, item.ItemType, item.ItemID, item.Note, item.AddedAt)
	if err == nil {
		r.pool.Exec(ctx, `UPDATE collections SET item_count = item_count+1 WHERE id=$1`, item.CollectionID)
	}
	return err
}

func (r *CollectionRepository) RemoveItem(ctx context.Context, collectionID, itemID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM collection_items WHERE collection_id=$1 AND item_id=$2`, collectionID, itemID)
	if err == nil && tag.RowsAffected() > 0 {
		r.pool.Exec(ctx, `UPDATE collections SET item_count = GREATEST(item_count-1,0) WHERE id=$1`, collectionID)
	}
	return err
}

func (r *CollectionRepository) GetItems(ctx context.Context, collectionID uuid.UUID) ([]CollectionItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, collection_id, item_type, item_id, note, added_at
		FROM collection_items WHERE collection_id = $1 ORDER BY added_at DESC
	`, collectionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []CollectionItem
	for rows.Next() {
		var i CollectionItem
		if err := rows.Scan(&i.ID, &i.CollectionID, &i.ItemType, &i.ItemID, &i.Note, &i.AddedAt); err != nil {
			continue
		}
		items = append(items, i)
	}
	return items, nil
}

func (r *CollectionRepository) Delete(ctx context.Context, collectionID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM collections WHERE id=$1 AND user_id=$2`, collectionID, userID)
	return err
}
