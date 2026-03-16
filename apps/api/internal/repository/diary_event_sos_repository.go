package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================
// Diary, Events, SOS Repositories
// ============================================

// --- Diary ---

type DiaryEntry struct {
	ID           uuid.UUID  `json:"id"`
	UserID       uuid.UUID  `json:"user_id"`
	Title        string     `json:"title"`
	Content      string     `json:"content"`
	Mood         string     `json:"mood"`
	LocationName *string    `json:"location_name"`
	Lat          *float64   `json:"lat"`
	Lng          *float64   `json:"lng"`
	PhotoURLs    []string   `json:"photo_urls"`
	IsPublic     bool       `json:"is_public"`
	Weather      *string    `json:"weather"`
	CreatedAt    time.Time  `json:"created_at"`
}

type DiaryRepository struct {
	pool *pgxpool.Pool
}

func NewDiaryRepository(pool *pgxpool.Pool) *DiaryRepository {
	return &DiaryRepository{pool: pool}
}

func (r *DiaryRepository) Create(ctx context.Context, entry *DiaryEntry) error {
	entry.ID = uuid.New()
	entry.CreatedAt = time.Now()
	if entry.Mood == "" { entry.Mood = "happy" }
	_, err := r.pool.Exec(ctx, `
		INSERT INTO diary_entries (id, user_id, title, content, mood, location_name, lat, lng, photo_urls, is_public, weather, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		entry.ID, entry.UserID, entry.Title, entry.Content, entry.Mood,
		entry.LocationName, entry.Lat, entry.Lng, entry.PhotoURLs, entry.IsPublic, entry.Weather, entry.CreatedAt)
	return err
}

func (r *DiaryRepository) ListByUser(ctx context.Context, userID uuid.UUID, limit int) ([]DiaryEntry, error) {
	if limit <= 0 || limit > 50 { limit = 20 }
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, title, content, mood, location_name, lat, lng, photo_urls, is_public, weather, created_at
		FROM diary_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`, userID, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var entries []DiaryEntry
	for rows.Next() {
		var e DiaryEntry
		rows.Scan(&e.ID, &e.UserID, &e.Title, &e.Content, &e.Mood, &e.LocationName,
			&e.Lat, &e.Lng, &e.PhotoURLs, &e.IsPublic, &e.Weather, &e.CreatedAt)
		entries = append(entries, e)
	}
	return entries, nil
}

func (r *DiaryRepository) ListPublic(ctx context.Context, limit int) ([]DiaryEntry, error) {
	if limit <= 0 || limit > 50 { limit = 20 }
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, title, content, mood, location_name, lat, lng, photo_urls, is_public, weather, created_at
		FROM diary_entries WHERE is_public = TRUE ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var entries []DiaryEntry
	for rows.Next() {
		var e DiaryEntry
		rows.Scan(&e.ID, &e.UserID, &e.Title, &e.Content, &e.Mood, &e.LocationName,
			&e.Lat, &e.Lng, &e.PhotoURLs, &e.IsPublic, &e.Weather, &e.CreatedAt)
		entries = append(entries, e)
	}
	return entries, nil
}

// --- Events ---

type LocalEvent struct {
	ID            uuid.UUID  `json:"id"`
	Title         string     `json:"title"`
	Description   string     `json:"description"`
	Category      string     `json:"category"`
	LocationName  string     `json:"location_name"`
	Lat           *float64   `json:"lat"`
	Lng           *float64   `json:"lng"`
	CoverImage    *string    `json:"cover_image"`
	Organizer     *string    `json:"organizer"`
	Price         int64      `json:"price"`
	IsFree        bool       `json:"is_free"`
	MaxAttendees  *int       `json:"max_attendees"`
	AttendeeCount int        `json:"attendee_count"`
	StartsAt      time.Time  `json:"starts_at"`
	EndsAt        time.Time  `json:"ends_at"`
	IsActive      bool       `json:"is_active"`
	UserRSVP      string     `json:"user_rsvp,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

type EventRepository struct {
	pool *pgxpool.Pool
}

func NewEventRepository(pool *pgxpool.Pool) *EventRepository {
	return &EventRepository{pool: pool}
}

func (r *EventRepository) ListUpcoming(ctx context.Context, category string, limit int) ([]LocalEvent, error) {
	if limit <= 0 || limit > 50 { limit = 20 }

	query := `SELECT id, title, description, category, location_name, lat, lng,
	          cover_image, organizer, price, is_free, max_attendees, attendee_count,
	          starts_at, ends_at, is_active, created_at
	          FROM local_events WHERE is_active = TRUE AND ends_at > NOW()`
	args := []interface{}{}
	if category != "" {
		query += fmt.Sprintf(" AND category = $%d", len(args)+1)
		args = append(args, category)
	}
	query += fmt.Sprintf(" ORDER BY starts_at ASC LIMIT $%d", len(args)+1)
	args = append(args, limit)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil { return nil, err }
	defer rows.Close()
	var events []LocalEvent
	for rows.Next() {
		var e LocalEvent
		rows.Scan(&e.ID, &e.Title, &e.Description, &e.Category, &e.LocationName, &e.Lat, &e.Lng,
			&e.CoverImage, &e.Organizer, &e.Price, &e.IsFree, &e.MaxAttendees, &e.AttendeeCount,
			&e.StartsAt, &e.EndsAt, &e.IsActive, &e.CreatedAt)
		events = append(events, e)
	}
	return events, nil
}

func (r *EventRepository) GetByID(ctx context.Context, id uuid.UUID) (*LocalEvent, error) {
	var e LocalEvent
	err := r.pool.QueryRow(ctx, `
		SELECT id, title, description, category, location_name, lat, lng,
		       cover_image, organizer, price, is_free, max_attendees, attendee_count,
		       starts_at, ends_at, is_active, created_at
		FROM local_events WHERE id = $1`, id,
	).Scan(&e.ID, &e.Title, &e.Description, &e.Category, &e.LocationName, &e.Lat, &e.Lng,
		&e.CoverImage, &e.Organizer, &e.Price, &e.IsFree, &e.MaxAttendees, &e.AttendeeCount,
		&e.StartsAt, &e.EndsAt, &e.IsActive, &e.CreatedAt)
	if err != nil { return nil, err }
	return &e, nil
}

func (r *EventRepository) RSVP(ctx context.Context, eventID, userID uuid.UUID, status string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO event_rsvps (event_id, user_id, status) VALUES ($1,$2,$3)
		ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status`,
		eventID, userID, status)
	if err != nil { return err }
	// Update count
	r.pool.Exec(ctx, `
		UPDATE local_events SET attendee_count = (
			SELECT COUNT(*) FROM event_rsvps WHERE event_id = $1 AND status = 'going'
		) WHERE id = $1`, eventID)
	return nil
}

// --- SOS ---

type SOSAlert struct {
	ID         uuid.UUID  `json:"id"`
	UserID     uuid.UUID  `json:"user_id"`
	UserName   string     `json:"user_name,omitempty"`
	AlertType  string     `json:"alert_type"`
	Message    *string    `json:"message"`
	Lat        float64    `json:"lat"`
	Lng        float64    `json:"lng"`
	Status     string     `json:"status"`
	ResolvedAt *time.Time `json:"resolved_at"`
	CreatedAt  time.Time  `json:"created_at"`
}

type SOSRepository struct {
	pool *pgxpool.Pool
}

func NewSOSRepository(pool *pgxpool.Pool) *SOSRepository {
	return &SOSRepository{pool: pool}
}

func (r *SOSRepository) CreateAlert(ctx context.Context, alert *SOSAlert) error {
	alert.ID = uuid.New()
	alert.Status = "active"
	alert.CreatedAt = time.Now()
	_, err := r.pool.Exec(ctx, `
		INSERT INTO sos_alerts (id, user_id, alert_type, message, lat, lng, status, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		alert.ID, alert.UserID, alert.AlertType, alert.Message, alert.Lat, alert.Lng, alert.Status, alert.CreatedAt)
	if err != nil { return err }
	r.pool.QueryRow(ctx, `SELECT full_name FROM users WHERE id=$1`, alert.UserID).Scan(&alert.UserName)
	return nil
}

func (r *SOSRepository) CancelAlert(ctx context.Context, alertID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE sos_alerts SET status = 'cancelled', resolved_at = NOW()
		WHERE id = $1 AND user_id = $2 AND status = 'active'`, alertID, userID)
	return err
}

func (r *SOSRepository) GetActive(ctx context.Context, userID uuid.UUID) (*SOSAlert, error) {
	var a SOSAlert
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, alert_type, message, lat, lng, status, created_at
		FROM sos_alerts WHERE user_id = $1 AND status = 'active'
		ORDER BY created_at DESC LIMIT 1`, userID,
	).Scan(&a.ID, &a.UserID, &a.AlertType, &a.Message, &a.Lat, &a.Lng, &a.Status, &a.CreatedAt)
	if err != nil { return nil, err }
	return &a, nil
}
