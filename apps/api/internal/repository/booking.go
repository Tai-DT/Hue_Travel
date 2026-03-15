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
// Booking Repository
// ============================================

type BookingRepository struct {
	pool *pgxpool.Pool
}

func NewBookingRepository(pool *pgxpool.Pool) *BookingRepository {
	return &BookingRepository{pool: pool}
}

func (r *BookingRepository) Create(ctx context.Context, booking *model.Booking) error {
	booking.ID = uuid.New()
	booking.CreatedAt = time.Now()
	booking.UpdatedAt = time.Now()

	bookingCode := fmt.Sprintf("HT-%s", strings.ToUpper(uuid.New().String()[:6]))

	_, err := r.pool.Exec(ctx, `
		INSERT INTO bookings (id, booking_code, traveler_id, experience_id, guide_id,
			booking_date, start_time, guest_count, unit_price, total_price, service_fee,
			status, special_notes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
		booking.ID, bookingCode, booking.TravelerID, booking.ExperienceID, booking.GuideID,
		booking.BookingDate, booking.StartTime, booking.GuestCount,
		booking.TotalPrice/int64(booking.GuestCount), booking.TotalPrice,
		booking.ServiceFee, model.BookingPending, booking.SpecialNotes,
		booking.CreatedAt, booking.UpdatedAt,
	)
	return err
}

func (r *BookingRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Booking, error) {
	b := &model.Booking{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, traveler_id, experience_id, guide_id, booking_date, start_time,
			   guest_count, total_price, service_fee, status, special_notes,
			   payment_method, payment_ref, paid_at, confirmed_at, completed_at,
			   created_at, updated_at
		FROM bookings WHERE id = $1`, id,
	).Scan(
		&b.ID, &b.TravelerID, &b.ExperienceID, &b.GuideID,
		&b.BookingDate, &b.StartTime, &b.GuestCount, &b.TotalPrice, &b.ServiceFee,
		&b.Status, &b.SpecialNotes, &b.PaymentMethod, &b.PaymentRef,
		&b.PaidAt, &b.ConfirmedAt, &b.CompletedAt, &b.CreatedAt, &b.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return b, err
}

func (r *BookingRepository) ListByTraveler(ctx context.Context, travelerID uuid.UUID, status string, page, perPage int) ([]model.Booking, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 50 {
		perPage = 10
	}

	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("b.traveler_id = $%d", argIdx))
	args = append(args, travelerID)
	argIdx++

	if status != "" {
		conditions = append(conditions, fmt.Sprintf("b.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	where := strings.Join(conditions, " AND ")

	var total int64
	r.pool.QueryRow(ctx,
		fmt.Sprintf("SELECT COUNT(*) FROM bookings b WHERE %s", where), args...,
	).Scan(&total)

	offset := (page - 1) * perPage
	args = append(args, perPage, offset)

	query := fmt.Sprintf(`
			SELECT b.id, b.traveler_id, b.experience_id, b.guide_id, b.booking_date,
				   b.start_time, b.guest_count, b.total_price, b.service_fee, b.status,
				   b.created_at, b.updated_at,
				   e.title, e.category, e.image_urls, e.duration_mins,
				   g.id, g.full_name, g.avatar_url
			FROM bookings b
			JOIN experiences e ON b.experience_id = e.id
			JOIN users g ON b.guide_id = g.id
			WHERE %s
			ORDER BY b.booking_date DESC
			LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var bookings []model.Booking
	for rows.Next() {
		var b model.Booking
		var exp model.Experience
		var guide model.User
		if err := rows.Scan(
			&b.ID, &b.TravelerID, &b.ExperienceID, &b.GuideID, &b.BookingDate,
			&b.StartTime, &b.GuestCount, &b.TotalPrice, &b.ServiceFee, &b.Status,
			&b.CreatedAt, &b.UpdatedAt,
			&exp.Title, &exp.Category, &exp.ImageURLs, &exp.DurationMins,
			&guide.ID, &guide.FullName, &guide.AvatarURL,
		); err != nil {
			return nil, 0, fmt.Errorf("scan booking: %w", err)
		}
		b.Experience = &exp
		b.Guide = &guide
		bookings = append(bookings, b)
	}

	return bookings, total, nil
}

// ListByGuide — bookings cho guide
func (r *BookingRepository) ListByGuide(ctx context.Context, guideID uuid.UUID, status string, page, perPage int) ([]model.Booking, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 50 {
		perPage = 10
	}

	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("b.guide_id = $%d", argIdx))
	args = append(args, guideID)
	argIdx++

	if status != "" {
		conditions = append(conditions, fmt.Sprintf("b.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	where := strings.Join(conditions, " AND ")

	var total int64
	r.pool.QueryRow(ctx,
		fmt.Sprintf("SELECT COUNT(*) FROM bookings b WHERE %s", where), args...,
	).Scan(&total)

	offset := (page - 1) * perPage
	args = append(args, perPage, offset)

	query := fmt.Sprintf(`
		SELECT b.id, b.traveler_id, b.experience_id, b.guide_id, b.booking_date,
			   b.start_time, b.guest_count, b.total_price, b.service_fee, b.status,
			   b.created_at, b.updated_at,
			   e.title, e.category, e.image_urls, e.duration_mins,
			   u.full_name
		FROM bookings b
		JOIN experiences e ON b.experience_id = e.id
		JOIN users u ON b.traveler_id = u.id
		WHERE %s
		ORDER BY b.booking_date DESC
		LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var bookings []model.Booking
	for rows.Next() {
		var b model.Booking
		var exp model.Experience
		var travelerName string
		if err := rows.Scan(
			&b.ID, &b.TravelerID, &b.ExperienceID, &b.GuideID, &b.BookingDate,
			&b.StartTime, &b.GuestCount, &b.TotalPrice, &b.ServiceFee, &b.Status,
			&b.CreatedAt, &b.UpdatedAt,
			&exp.Title, &exp.Category, &exp.ImageURLs, &exp.DurationMins,
			&travelerName,
		); err != nil {
			return nil, 0, fmt.Errorf("scan guide booking: %w", err)
		}
		b.Experience = &exp
		b.Traveler = &model.User{FullName: travelerName}
		bookings = append(bookings, b)
	}

	return bookings, total, nil
}

// ListAll — tất cả bookings (admin)
func (r *BookingRepository) ListAll(ctx context.Context, status string, page, perPage int, startDate *time.Time) ([]model.Booking, int64, error) {
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

	if status != "" {
		conditions = append(conditions, fmt.Sprintf("b.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}
	if startDate != nil {
		conditions = append(conditions, fmt.Sprintf("b.created_at >= $%d", argIdx))
		args = append(args, *startDate)
		argIdx++
	}

	where := strings.Join(conditions, " AND ")

	var total int64
	r.pool.QueryRow(ctx,
		fmt.Sprintf("SELECT COUNT(*) FROM bookings b WHERE %s", where), args...,
	).Scan(&total)

	offset := (page - 1) * perPage
	args = append(args, perPage, offset)

	query := fmt.Sprintf(`
		SELECT b.id, b.traveler_id, b.experience_id, b.guide_id, b.booking_date,
			   b.start_time, b.guest_count, b.total_price, b.service_fee, b.status,
			   b.created_at, b.updated_at,
			   e.title, e.category, e.image_urls, e.duration_mins
		FROM bookings b
		JOIN experiences e ON b.experience_id = e.id
		WHERE %s
		ORDER BY b.created_at DESC
		LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var bookings []model.Booking
	for rows.Next() {
		var b model.Booking
		var exp model.Experience
		if err := rows.Scan(
			&b.ID, &b.TravelerID, &b.ExperienceID, &b.GuideID, &b.BookingDate,
			&b.StartTime, &b.GuestCount, &b.TotalPrice, &b.ServiceFee, &b.Status,
			&b.CreatedAt, &b.UpdatedAt,
			&exp.Title, &exp.Category, &exp.ImageURLs, &exp.DurationMins,
		); err != nil {
			return nil, 0, fmt.Errorf("scan admin booking: %w", err)
		}
		b.Experience = &exp
		bookings = append(bookings, b)
	}

	return bookings, total, nil
}

func (r *BookingRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status model.BookingStatus) error {
	var timestampCol string
	switch status {
	case model.BookingConfirmed:
		timestampCol = "confirmed_at"
	case model.BookingActive:
		timestampCol = "started_at"
	case model.BookingCompleted:
		timestampCol = "completed_at"
	case model.BookingCancelled:
		timestampCol = "cancelled_at"
	}

	query := fmt.Sprintf(
		`UPDATE bookings SET status = $1, %s = NOW(), updated_at = NOW() WHERE id = $2`,
		timestampCol)
	_, err := r.pool.Exec(ctx, query, status, id)
	return err
}

func (r *BookingRepository) SetPayment(ctx context.Context, id uuid.UUID, method, ref string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE bookings SET payment_method = $1, payment_ref = $2, paid_at = NOW(), updated_at = NOW()
		WHERE id = $3`, method, ref, id)
	return err
}

func (r *BookingRepository) UpdatePaymentRef(ctx context.Context, id uuid.UUID, ref string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE bookings SET payment_ref = $1, updated_at = NOW() WHERE id = $2`, ref, id)
	return err
}

func (r *BookingRepository) GetByPaymentRef(ctx context.Context, ref string) (*model.Booking, error) {
	b := &model.Booking{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, traveler_id, experience_id, guide_id, booking_date, start_time,
			   guest_count, total_price, service_fee, status, special_notes,
			   payment_method, payment_ref, paid_at, confirmed_at, completed_at,
			   created_at, updated_at
		FROM bookings WHERE payment_ref = $1`, ref,
	).Scan(
		&b.ID, &b.TravelerID, &b.ExperienceID, &b.GuideID,
		&b.BookingDate, &b.StartTime, &b.GuestCount, &b.TotalPrice, &b.ServiceFee,
		&b.Status, &b.SpecialNotes, &b.PaymentMethod, &b.PaymentRef,
		&b.PaidAt, &b.ConfirmedAt, &b.CompletedAt, &b.CreatedAt, &b.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return b, err
}

func (r *BookingRepository) UpdatePaymentInfo(ctx context.Context, id uuid.UUID, transactionNo string, paidAt *time.Time) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE bookings SET payment_ref = $1, paid_at = $2, updated_at = NOW()
		WHERE id = $3`, transactionNo, paidAt, id)
	return err
}
