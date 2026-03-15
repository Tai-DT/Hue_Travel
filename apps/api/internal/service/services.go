package service

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/huetravel/api/internal/middleware"
	"github.com/huetravel/api/internal/model"
	"github.com/huetravel/api/internal/repository"
)

// ============================================
// Auth Service
// ============================================

type AuthService struct {
	userRepo         repository.UserRepo
	otpRepo          repository.OTPRepo
	redis            *redis.Client
	smsSvc           *SMSService
	jwtSecret        string
	jwtExpiry        time.Duration
	jwtRefreshExpiry time.Duration
}

func NewAuthService(
	userRepo repository.UserRepo,
	otpRepo repository.OTPRepo,
	rdb *redis.Client,
	smsSvc *SMSService,
	jwtSecret string,
	jwtExpiry, jwtRefreshExpiry time.Duration,
) *AuthService {
	return &AuthService{
		userRepo:         userRepo,
		otpRepo:          otpRepo,
		redis:            rdb,
		smsSvc:           smsSvc,
		jwtSecret:        jwtSecret,
		jwtExpiry:        jwtExpiry,
		jwtRefreshExpiry: jwtRefreshExpiry,
	}
}

type SendOTPRequest struct {
	Phone string `json:"phone" binding:"required"`
}

type VerifyOTPRequest struct {
	Phone string `json:"phone" binding:"required"`
	Code  string `json:"code" binding:"required,len=6"`
}

type AuthResponse struct {
	Token        string      `json:"token"`
	RefreshToken string      `json:"refresh_token"`
	ExpiresIn    int         `json:"expires_in"` // seconds
	User         *model.User `json:"user"`
	IsNewUser    bool        `json:"is_new_user"`
}

// SendOTP — Tạo và gửi mã OTP
func (s *AuthService) SendOTP(ctx context.Context, req SendOTPRequest) error {
	// Rate limit: max 3 OTP per 10 minutes
	if s.redis != nil {
		rateLimitKey := fmt.Sprintf("otp:ratelimit:%s", req.Phone)
		count, _ := s.redis.Incr(ctx, rateLimitKey).Result()
		if count == 1 {
			s.redis.Expire(ctx, rateLimitKey, 10*time.Minute)
		}
		if count > 3 {
			return fmt.Errorf("quá nhiều yêu cầu OTP, vui lòng thử lại sau 10 phút")
		}
	}

	// Generate 6-digit OTP
	code := generateOTPCode()
	if s.smsSvc != nil && !s.smsSvc.IsConfigured() {
		code = devOTPCode()
	}
	expiresAt := time.Now().Add(5 * time.Minute)

	// Save to database
	_, err := s.otpRepo.Create(ctx, req.Phone, code, expiresAt)
	if err != nil {
		return fmt.Errorf("không thể tạo OTP: %w", err)
	}

	// Cache for quick lookup
	if s.redis != nil {
		s.redis.Set(ctx, fmt.Sprintf("otp:%s", req.Phone), code, 5*time.Minute)
	}

	// Send OTP via SMS
	if s.smsSvc != nil {
		if err := s.smsSvc.SendOTP(req.Phone, code); err != nil {
			if !s.smsSvc.FallbackEnabled() {
				return fmt.Errorf("không thể gửi OTP: %w", err)
			}
			log.Printf("⚠️ SMS send failed: %v — OTP logged to console", err)
			fmt.Printf("📱 OTP for %s: %s (expires: %s)\n", req.Phone, code, expiresAt.Format("15:04:05"))
		}
	} else {
		// Development mode — log OTP
		fmt.Printf("📱 OTP for %s: %s (expires: %s)\n", req.Phone, code, expiresAt.Format("15:04:05"))
	}

	return nil
}

// VerifyOTP — Xác thực OTP và trả về JWT
func (s *AuthService) VerifyOTP(ctx context.Context, req VerifyOTPRequest) (*AuthResponse, error) {
	// Quick check from Redis first
	if s.redis != nil {
		cachedCode, err := s.redis.Get(ctx, fmt.Sprintf("otp:%s", req.Phone)).Result()
		if err == nil && cachedCode == req.Code {
			// Valid! Delete from cache
			s.redis.Del(ctx, fmt.Sprintf("otp:%s", req.Phone))
		} else {
			// Fallback to database verification
			valid, err := s.otpRepo.Verify(ctx, req.Phone, req.Code)
			if err != nil {
				return nil, fmt.Errorf("lỗi xác thực: %w", err)
			}
			if !valid {
				return nil, fmt.Errorf("mã OTP không đúng hoặc đã hết hạn")
			}
		}
	} else {
		valid, err := s.otpRepo.Verify(ctx, req.Phone, req.Code)
		if err != nil {
			return nil, fmt.Errorf("lỗi xác thực: %w", err)
		}
		if !valid {
			return nil, fmt.Errorf("mã OTP không đúng hoặc đã hết hạn")
		}
	}

	// Find or create user
	isNewUser := false
	user, err := s.userRepo.GetByPhone(ctx, req.Phone)
	if err != nil {
		return nil, err
	}

	if user == nil {
		// Create new user
		isNewUser = true
		user = &model.User{
			Phone:    &req.Phone,
			FullName: "Người dùng mới",
			Role:     model.RoleTraveler,
			IsActive: true,
		}
		if err := s.userRepo.Create(ctx, user); err != nil {
			return nil, fmt.Errorf("không thể tạo tài khoản: %w", err)
		}
	}

	// Update last login
	s.userRepo.UpdateLastLogin(ctx, user.ID)

	return s.issueTokens(ctx, user, isNewUser)
}

// GoogleLogin — Xử lý Google OAuth
func (s *AuthService) GoogleLogin(ctx context.Context, idToken string) (*AuthResponse, error) {
	// Verify Google ID token
	googleUser, err := verifyGoogleToken(idToken)
	if err != nil {
		return nil, fmt.Errorf("token Google không hợp lệ: %w", err)
	}

	// Find or create user
	isNewUser := false
	user, err := s.userRepo.GetByGoogleID(ctx, googleUser.ID)
	if err != nil {
		return nil, err
	}

	if user == nil {
		isNewUser = true
		user, err = s.userRepo.CreateWithGoogle(ctx, googleUser.ID, googleUser.Email, googleUser.Name, googleUser.Picture)
		if err != nil {
			return nil, fmt.Errorf("không thể tạo tài khoản: %w", err)
		}
	}

	s.userRepo.UpdateLastLogin(ctx, user.ID)

	return s.issueTokens(ctx, user, isNewUser)
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

// ============================================
// Helpers
// ============================================

func generateOTPCode() string {
	code := ""
	for i := 0; i < 6; i++ {
		n, _ := rand.Int(rand.Reader, big.NewInt(10))
		code += fmt.Sprintf("%d", n.Int64())
	}
	return code
}

func devOTPCode() string {
	if code := os.Getenv("DEV_FIXED_OTP"); code != "" {
		return code
	}
	return "123456"
}

type GoogleUser struct {
	ID            string `json:"sub"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Audience      string `json:"aud"`
	EmailVerified string `json:"email_verified"`
}

func verifyGoogleToken(idToken string) (*GoogleUser, error) {
	resp, err := http.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("invalid token")
	}

	body, _ := io.ReadAll(resp.Body)
	var user GoogleUser
	if err := json.Unmarshal(body, &user); err != nil {
		return nil, err
	}
	if user.Email == "" || user.EmailVerified != "true" {
		return nil, fmt.Errorf("google account is not verified")
	}
	if clientID := os.Getenv("GOOGLE_CLIENT_ID"); clientID != "" && user.Audience != clientID {
		return nil, fmt.Errorf("google token audience mismatch")
	}
	return &user, nil
}
