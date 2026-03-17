package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"github.com/huetravel/api/internal/middleware"
	"github.com/huetravel/api/internal/model"
	"github.com/huetravel/api/internal/repository"
)

// ============================================
// Auth Service
// ============================================

type AuthService struct {
	userRepo         repository.UserRepo
	redis            *redis.Client
	jwtSecret        string
	jwtExpiry        time.Duration
	jwtRefreshExpiry time.Duration
}

func NewAuthService(
	userRepo repository.UserRepo,
	rdb *redis.Client,
	jwtSecret string,
	jwtExpiry, jwtRefreshExpiry time.Duration,
) *AuthService {
	return &AuthService{
		userRepo:         userRepo,
		redis:            rdb,
		jwtSecret:        jwtSecret,
		jwtExpiry:        jwtExpiry,
		jwtRefreshExpiry: jwtRefreshExpiry,
	}
}

type RegisterRequest struct {
	FullName string `json:"full_name" binding:"required,min=2"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

type PasswordLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type UpdatePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

type AuthResponse struct {
	Token        string      `json:"token"`
	RefreshToken string      `json:"refresh_token"`
	ExpiresIn    int         `json:"expires_in"` // seconds
	User         *model.User `json:"user"`
	IsNewUser    bool        `json:"is_new_user"`
}

// Register creates a local account with email/password for Expo and web clients.
func (s *AuthService) Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
	fullName := strings.TrimSpace(req.FullName)
	email := normalizeAuthEmail(req.Email)
	password := strings.TrimSpace(req.Password)

	switch {
	case fullName == "":
		return nil, fmt.Errorf("vui lòng nhập họ tên")
	case email == "":
		return nil, fmt.Errorf("vui lòng nhập email hợp lệ")
	case len(password) < 8:
		return nil, fmt.Errorf("mật khẩu phải có ít nhất 8 ký tự")
	}

	existingByEmail, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if existingByEmail != nil {
		return nil, fmt.Errorf("email đã được sử dụng")
	}

	passwordHashBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("không thể bảo mật mật khẩu")
	}
	passwordHash := string(passwordHashBytes)

	user := &model.User{
		Email:        &email,
		PasswordHash: &passwordHash,
		HasPassword:  true,
		FullName:     fullName,
		Role:         model.RoleTraveler,
		IsActive:     true,
		IsVerified:   false,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("không thể tạo tài khoản: %w", err)
	}
	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

	return s.issueTokens(ctx, user, true)
}

// LoginWithPassword authenticates an existing user using email and password.
func (s *AuthService) LoginWithPassword(ctx context.Context, req PasswordLoginRequest) (*AuthResponse, error) {
	email := normalizeAuthEmail(req.Email)
	password := req.Password

	if email == "" || password == "" {
		return nil, fmt.Errorf("vui lòng nhập đầy đủ email và mật khẩu")
	}

	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user == nil || !model.HasUsablePasswordHash(user.PasswordHash) {
		return nil, fmt.Errorf("email hoặc mật khẩu không đúng")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("email hoặc mật khẩu không đúng")
	}

	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)
	return s.issueTokens(ctx, user, false)
}

// UpdatePassword lets existing users set a first password or rotate an existing one.
func (s *AuthService) UpdatePassword(ctx context.Context, userID uuid.UUID, req UpdatePasswordRequest) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if user == nil {
		return fmt.Errorf("không tìm thấy người dùng")
	}

	newPassword := strings.TrimSpace(req.NewPassword)
	if len(newPassword) < 8 {
		return fmt.Errorf("mật khẩu mới phải có ít nhất 8 ký tự")
	}

	hasExistingPassword := model.HasUsablePasswordHash(user.PasswordHash)
	if hasExistingPassword {
		if strings.TrimSpace(req.CurrentPassword) == "" {
			return fmt.Errorf("vui lòng nhập mật khẩu hiện tại")
		}
		if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
			return fmt.Errorf("mật khẩu hiện tại không đúng")
		}
	}

	passwordHashBytes, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("không thể bảo mật mật khẩu")
	}

	if err := s.userRepo.UpdatePassword(ctx, userID, string(passwordHashBytes)); err != nil {
		return fmt.Errorf("không thể cập nhật mật khẩu: %w", err)
	}

	return nil
}

// RefreshToken — Renew JWT token
func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*AuthResponse, error) {
	refreshToken = strings.TrimSpace(refreshToken)
	if refreshToken == "" {
		return nil, fmt.Errorf("thiếu refresh token")
	}

	claims, err := middleware.ParseToken(refreshToken, s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("refresh token không hợp lệ hoặc đã hết hạn")
	}
	if !middleware.IsRefreshTokenType(claims.Type) {
		if claims.Type != "" || s.redis == nil {
			return nil, fmt.Errorf("refresh token không hợp lệ")
		}
	}

	if s.redis != nil {
		storedToken, redisErr := s.redis.Get(ctx, fmt.Sprintf("refresh:%s", claims.UserID.String())).Result()
		if redisErr != nil || storedToken != refreshToken {
			return nil, fmt.Errorf("refresh token đã hết hiệu lực")
		}
	}

	user, err := s.userRepo.GetByID(ctx, claims.UserID)
	if err != nil || user == nil {
		return nil, fmt.Errorf("không tìm thấy người dùng")
	}

	return s.issueTokens(ctx, user, false)
}

func (s *AuthService) issueTokens(ctx context.Context, user *model.User, isNewUser bool) (*AuthResponse, error) {
	token, err := middleware.GenerateTokenWithType(
		user.ID,
		string(user.Role),
		middleware.TokenTypeAccess,
		s.jwtSecret,
		s.jwtExpiry,
	)
	if err != nil {
		return nil, fmt.Errorf("không thể tạo token: %w", err)
	}

	refreshToken, err := middleware.GenerateTokenWithType(
		user.ID,
		string(user.Role),
		middleware.TokenTypeRefresh,
		s.jwtSecret,
		s.jwtRefreshExpiry,
	)
	if err != nil {
		return nil, fmt.Errorf("không thể tạo refresh token: %w", err)
	}

	if s.redis != nil {
		s.redis.Set(ctx, fmt.Sprintf("refresh:%s", user.ID.String()), refreshToken, s.jwtRefreshExpiry)
	}

	return &AuthResponse{
		Token:        token,
		RefreshToken: refreshToken,
		ExpiresIn:    int(s.jwtExpiry.Seconds()),
		User:         user,
		IsNewUser:    isNewUser,
	}, nil
}

// GetUser returns user profile by ID.
func (s *AuthService) GetUser(ctx context.Context, userID uuid.UUID) (*model.User, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("lỗi truy vấn: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("không tìm thấy người dùng")
	}
	return user, nil
}

// UpdateUserProfile updates user profile and returns the updated user.
func (s *AuthService) UpdateUserProfile(ctx context.Context, userID uuid.UUID, fullName string, email, bio, avatarURL *string, languages []string) (*model.User, error) {
	if err := s.userRepo.UpdateProfile(ctx, userID, fullName, email, bio, avatarURL, languages); err != nil {
		return nil, err
	}
	return s.userRepo.GetByID(ctx, userID)
}

// DeactivateAccount soft-deletes user and invalidates tokens.
func (s *AuthService) DeactivateAccount(ctx context.Context, userID uuid.UUID) error {
	if err := s.userRepo.SetActive(ctx, userID, false); err != nil {
		return fmt.Errorf("không thể xóa tài khoản: %w", err)
	}
	// Invalidate refresh tokens
	if s.redis != nil {
		s.redis.Del(ctx, fmt.Sprintf("refresh:%s", userID.String()))
	}
	return nil
}

// Logout invalidates the user's refresh token.
func (s *AuthService) Logout(ctx context.Context, userID uuid.UUID) {
	if s.redis != nil {
		s.redis.Del(ctx, fmt.Sprintf("refresh:%s", userID.String()))
	}
}

func normalizeAuthEmail(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

// ============================================
// Booking Service
// ============================================

type BookingService struct {
	bookingRepo repository.BookingRepo
	expRepo     repository.ExperienceRepo
	userRepo    repository.UserRepo
	redis       *redis.Client
}

func NewBookingService(
	bookingRepo repository.BookingRepo,
	expRepo repository.ExperienceRepo,
	userRepo repository.UserRepo,
	rdb *redis.Client,
) *BookingService {
	return &BookingService{
		bookingRepo: bookingRepo,
		expRepo:     expRepo,
		userRepo:    userRepo,
		redis:       rdb,
	}
}

type CreateBookingRequest struct {
	ExperienceID string `json:"experience_id" binding:"required"`
	BookingDate  string `json:"booking_date" binding:"required"` // "2026-03-15"
	StartTime    string `json:"start_time" binding:"required"`   // "19:00"
	GuestCount   int    `json:"guest_count" binding:"required,min=1,max=20"`
	SpecialNotes string `json:"special_notes,omitempty"`
}

type BookingResponse struct {
	Booking    *model.Booking `json:"booking"`
	PaymentURL string         `json:"payment_url,omitempty"`
}

func (s *BookingService) CreateBooking(ctx context.Context, travelerID uuid.UUID, req CreateBookingRequest) (*BookingResponse, error) {
	// 1. Validate experience
	expID, err := uuid.Parse(req.ExperienceID)
	if err != nil {
		return nil, fmt.Errorf("experience ID không hợp lệ")
	}

	experience, err := s.expRepo.GetByID(ctx, expID)
	if err != nil || experience == nil {
		return nil, fmt.Errorf("trải nghiệm không tồn tại")
	}

	// 2. Validate guest count
	if req.GuestCount > experience.MaxGuests {
		return nil, fmt.Errorf("số khách tối đa là %d", experience.MaxGuests)
	}

	// 3. Parse booking date
	bookingDate, err := time.Parse("2006-01-02", req.BookingDate)
	if err != nil {
		return nil, fmt.Errorf("ngày đặt không hợp lệ (format: YYYY-MM-DD)")
	}
	if bookingDate.Before(time.Now().Truncate(24 * time.Hour)) {
		return nil, fmt.Errorf("không thể đặt cho ngày trong quá khứ")
	}

	// 4. Calculate pricing
	totalPrice := experience.Price * int64(req.GuestCount)
	serviceFee := totalPrice * 5 / 100 // 5% platform fee

	// 5. Check for duplicate booking
	dupKey := fmt.Sprintf("booking:dup:%s:%s:%s", travelerID, req.ExperienceID, req.BookingDate)
	if s.redis != nil {
		if exists, _ := s.redis.Exists(ctx, dupKey).Result(); exists > 0 {
			return nil, fmt.Errorf("bạn đã đặt trải nghiệm này cho ngày này rồi")
		}
	}

	// 6. Create booking
	notes := req.SpecialNotes
	booking := &model.Booking{
		TravelerID:   travelerID,
		ExperienceID: expID,
		GuideID:      experience.GuideID,
		BookingDate:  bookingDate,
		StartTime:    req.StartTime,
		GuestCount:   req.GuestCount,
		TotalPrice:   totalPrice + serviceFee,
		ServiceFee:   serviceFee,
		Status:       model.BookingPending,
		SpecialNotes: &notes,
	}

	if err := s.bookingRepo.Create(ctx, booking); err != nil {
		return nil, fmt.Errorf("không thể tạo booking: %w", err)
	}

	// 7. Set duplicate prevention (24h)
	if s.redis != nil {
		s.redis.Set(ctx, dupKey, "1", 24*time.Hour)
	}

	// 8. Set booking timeout (30 min to pay)
	if s.redis != nil {
		s.redis.Set(ctx, fmt.Sprintf("booking:timeout:%s", booking.ID), "1", 30*time.Minute)
	}

	booking.Experience = experience

	return &BookingResponse{
		Booking: booking,
		// PaymentURL will be set after user chooses payment method
	}, nil
}

func (s *BookingService) CancelBooking(ctx context.Context, bookingID, userID uuid.UUID, reason string) error {
	booking, err := s.bookingRepo.GetByID(ctx, bookingID)
	if err != nil || booking == nil {
		return fmt.Errorf("booking không tồn tại")
	}

	// Check ownership
	if booking.TravelerID != userID && booking.GuideID != userID {
		return fmt.Errorf("bạn không có quyền huỷ booking này")
	}

	// Check if cancellable
	if booking.Status != model.BookingPending && booking.Status != model.BookingConfirmed {
		return fmt.Errorf("không thể huỷ booking ở trạng thái %s", booking.Status)
	}

	return s.bookingRepo.UpdateStatus(ctx, bookingID, model.BookingCancelled)
}

// ConfirmBooking — guide confirms a pending booking.
func (s *BookingService) ConfirmBooking(ctx context.Context, bookingID, guideID uuid.UUID) error {
	booking, err := s.bookingRepo.GetByID(ctx, bookingID)
	if err != nil || booking == nil {
		return fmt.Errorf("booking không tồn tại")
	}

	if booking.GuideID != guideID {
		return fmt.Errorf("chỉ hướng dẫn viên mới có thể xác nhận booking")
	}

	if booking.Status != model.BookingPending {
		return fmt.Errorf("booking không ở trạng thái chờ xác nhận")
	}

	return s.bookingRepo.UpdateStatus(ctx, bookingID, model.BookingConfirmed)
}

// CompleteBooking — guide marks a confirmed/active booking as completed.
func (s *BookingService) CompleteBooking(ctx context.Context, bookingID, guideID uuid.UUID) error {
	booking, err := s.bookingRepo.GetByID(ctx, bookingID)
	if err != nil || booking == nil {
		return fmt.Errorf("booking không tồn tại")
	}

	if booking.GuideID != guideID {
		return fmt.Errorf("chỉ hướng dẫn viên mới có thể hoàn thành booking")
	}

	if booking.Status != model.BookingConfirmed && booking.Status != model.BookingActive {
		return fmt.Errorf("booking chưa được xác nhận")
	}

	return s.bookingRepo.UpdateStatus(ctx, bookingID, model.BookingCompleted)
}

// GetBooking retrieves a single booking by ID.
func (s *BookingService) GetBooking(ctx context.Context, bookingID uuid.UUID) (*model.Booking, error) {
	booking, err := s.bookingRepo.GetByID(ctx, bookingID)
	if err != nil {
		return nil, fmt.Errorf("lỗi truy vấn booking: %w", err)
	}
	if booking == nil {
		return nil, fmt.Errorf("booking không tồn tại")
	}
	return booking, nil
}

// ListTravelerBookings lists bookings for a traveler with pagination.
func (s *BookingService) ListTravelerBookings(ctx context.Context, travelerID uuid.UUID, status string, page, perPage int) ([]model.Booking, int64, error) {
	return s.bookingRepo.ListByTraveler(ctx, travelerID, status, page, perPage)
}

// ListGuideBookings lists bookings for a guide with pagination.
func (s *BookingService) ListGuideBookings(ctx context.Context, guideID uuid.UUID, status string, page, perPage int) ([]model.Booking, int64, error) {
	return s.bookingRepo.ListByGuide(ctx, guideID, status, page, perPage)
}
