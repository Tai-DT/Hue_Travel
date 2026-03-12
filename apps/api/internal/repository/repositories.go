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
	user := &model.User{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, phone, email, full_name, avatar_url, role, bio, languages,
			   xp, level, is_verified, is_active, last_login_at, created_at, updated_at
		FROM users WHERE phone = $1 AND is_active = TRUE`, phone,
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
func (r *UserRepository) UpdateProfile(ctx context.Context, userID uuid.UUID, fullName string, bio, avatarURL *string, languages []string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE users SET full_name = $1, bio = $2, avatar_url = $3, languages = $4, updated_at = NOW()
		WHERE id = $5 AND is_active = TRUE`,
		fullName, bio, avatarURL, languages, userID)
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
		rows.Scan(
			&u.ID, &u.Phone, &u.Email, &u.FullName, &u.AvatarURL,
			&u.Role, &u.Bio, &u.Languages,
			&u.XP, &u.Level, &u.IsVerified, &u.IsActive,
			&u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
		)
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
	Category string
	MinPrice int64
	MaxPrice int64
	GuideID  *uuid.UUID
	Search   string
	Page     int
	PerPage  int
	SortBy   string // "rating", "price_asc", "price_desc", "newest"
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

	conditions = append(conditions, "e.is_active = TRUE")

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
		err := rows.Scan(
			&exp.ID, &exp.GuideID, &exp.Title, &exp.Description, &exp.Category,
			&exp.Price, &exp.MaxGuests, &exp.DurationMins,
			&exp.MeetingPoint, &exp.MeetingLat, &exp.MeetingLng,
			&exp.Includes, &exp.Highlights, &exp.ImageURLs,
			&exp.Rating, &exp.RatingCount, &exp.IsInstant, &exp.IsActive,
			&exp.CreatedAt, &exp.UpdatedAt,
			&guide.ID, &guide.FullName, &guide.AvatarURL, &guide.Role,
		)
		if err != nil {
			return nil, 0, err
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
			   e.title, e.category, e.image_urls, e.duration_mins
		FROM bookings b
		JOIN experiences e ON b.experience_id = e.id
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
		err := rows.Scan(
			&b.ID, &b.TravelerID, &b.ExperienceID, &b.GuideID, &b.BookingDate,
			&b.StartTime, &b.GuestCount, &b.TotalPrice, &b.ServiceFee, &b.Status,
			&b.CreatedAt, &b.UpdatedAt,
			&exp.Title, &exp.Category, &exp.ImageURLs, &exp.DurationMins,
		)
		if err != nil {
			return nil, 0, err
		}
		b.Experience = &exp
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
		err := rows.Scan(
			&b.ID, &b.TravelerID, &b.ExperienceID, &b.GuideID, &b.BookingDate,
			&b.StartTime, &b.GuestCount, &b.TotalPrice, &b.ServiceFee, &b.Status,
			&b.CreatedAt, &b.UpdatedAt,
			&exp.Title, &exp.Category, &exp.ImageURLs, &exp.DurationMins,
			&travelerName,
		)
		if err != nil {
			return nil, 0, err
		}
		b.Experience = &exp
		b.Traveler = &model.User{FullName: travelerName}
		bookings = append(bookings, b)
	}

	return bookings, total, nil
}

// ListAll — tất cả bookings (admin)
func (r *BookingRepository) ListAll(ctx context.Context, status string, page, perPage int) ([]model.Booking, int64, error) {
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
		rows.Scan(
			&b.ID, &b.TravelerID, &b.ExperienceID, &b.GuideID, &b.BookingDate,
			&b.StartTime, &b.GuestCount, &b.TotalPrice, &b.ServiceFee, &b.Status,
			&b.CreatedAt, &b.UpdatedAt,
			&exp.Title, &exp.Category, &exp.ImageURLs, &exp.DurationMins,
		)
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

// ============================================
// Helpers
// ============================================

func generateSlug(title string) string {
	slug := strings.ToLower(title)
	slug = strings.ReplaceAll(slug, " ", "-")
	// Remove Vietnamese diacritics would go here in production
	slug = fmt.Sprintf("%s-%s", slug, uuid.New().String()[:8])
	return slug
}
