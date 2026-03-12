package service

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
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
	userRepo         *repository.UserRepository
	otpRepo          *repository.OTPRepository
	redis            *redis.Client
	jwtSecret        string
	jwtExpiry        time.Duration
	jwtRefreshExpiry time.Duration
}

func NewAuthService(
	userRepo *repository.UserRepository,
	otpRepo *repository.OTPRepository,
	rdb *redis.Client,
	jwtSecret string,
	jwtExpiry, jwtRefreshExpiry time.Duration,
) *AuthService {
	return &AuthService{
		userRepo:         userRepo,
		otpRepo:          otpRepo,
		redis:            rdb,
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
	rateLimitKey := fmt.Sprintf("otp:ratelimit:%s", req.Phone)
	count, _ := s.redis.Incr(ctx, rateLimitKey).Result()
	if count == 1 {
		s.redis.Expire(ctx, rateLimitKey, 10*time.Minute)
	}
	if count > 3 {
		return fmt.Errorf("quá nhiều yêu cầu OTP, vui lòng thử lại sau 10 phút")
	}

	// Generate 6-digit OTP
	code := generateOTPCode()
	expiresAt := time.Now().Add(5 * time.Minute)

	// Save to database
	_, err := s.otpRepo.Create(ctx, req.Phone, code, expiresAt)
	if err != nil {
		return fmt.Errorf("không thể tạo OTP: %w", err)
	}

	// Cache for quick lookup
	s.redis.Set(ctx, fmt.Sprintf("otp:%s", req.Phone), code, 5*time.Minute)

	// TODO: Send via ESMS.vn
	// For now, log the OTP (development mode)
	fmt.Printf("📱 OTP for %s: %s (expires: %s)\n", req.Phone, code, expiresAt.Format("15:04:05"))

	return nil
}

// VerifyOTP — Xác thực OTP và trả về JWT
func (s *AuthService) VerifyOTP(ctx context.Context, req VerifyOTPRequest) (*AuthResponse, error) {
	// Quick check from Redis first
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

	// Generate JWT tokens
	token, err := middleware.GenerateToken(user.ID, string(user.Role), s.jwtSecret, s.jwtExpiry)
	if err != nil {
		return nil, fmt.Errorf("không thể tạo token: %w", err)
	}

	refreshToken, err := middleware.GenerateToken(user.ID, string(user.Role), s.jwtSecret, s.jwtRefreshExpiry)
	if err != nil {
		return nil, fmt.Errorf("không thể tạo refresh token: %w", err)
	}

	// Store refresh token in Redis
	s.redis.Set(ctx, fmt.Sprintf("refresh:%s", user.ID.String()), refreshToken, s.jwtRefreshExpiry)

	return &AuthResponse{
		Token:        token,
		RefreshToken: refreshToken,
		ExpiresIn:    int(s.jwtExpiry.Seconds()),
		User:         user,
		IsNewUser:    isNewUser,
	}, nil
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

	token, _ := middleware.GenerateToken(user.ID, string(user.Role), s.jwtSecret, s.jwtExpiry)
	refreshToken, _ := middleware.GenerateToken(user.ID, string(user.Role), s.jwtSecret, s.jwtRefreshExpiry)
	s.redis.Set(ctx, fmt.Sprintf("refresh:%s", user.ID.String()), refreshToken, s.jwtRefreshExpiry)

	return &AuthResponse{
		Token:        token,
		RefreshToken: refreshToken,
		ExpiresIn:    int(s.jwtExpiry.Seconds()),
		User:         user,
		IsNewUser:    isNewUser,
	}, nil
}

// RefreshToken — Renew JWT token
func (s *AuthService) RefreshToken(ctx context.Context, userID uuid.UUID, role string) (*AuthResponse, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return nil, fmt.Errorf("user not found")
	}

	token, _ := middleware.GenerateToken(user.ID, string(user.Role), s.jwtSecret, s.jwtExpiry)
	refreshToken, _ := middleware.GenerateToken(user.ID, string(user.Role), s.jwtSecret, s.jwtRefreshExpiry)

	return &AuthResponse{
		Token:        token,
		RefreshToken: refreshToken,
		ExpiresIn:    int(s.jwtExpiry.Seconds()),
		User:         user,
	}, nil
}

// ============================================
// Booking Service
// ============================================

type BookingService struct {
	bookingRepo *repository.BookingRepository
	expRepo     *repository.ExperienceRepository
	userRepo    *repository.UserRepository
	redis       *redis.Client
}

func NewBookingService(
	bookingRepo *repository.BookingRepository,
	expRepo *repository.ExperienceRepository,
	userRepo *repository.UserRepository,
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
	if exists, _ := s.redis.Exists(ctx, dupKey).Result(); exists > 0 {
		return nil, fmt.Errorf("bạn đã đặt trải nghiệm này cho ngày này rồi")
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
	s.redis.Set(ctx, dupKey, "1", 24*time.Hour)

	// 8. Set booking timeout (30 min to pay)
	s.redis.Set(ctx, fmt.Sprintf("booking:timeout:%s", booking.ID), "1", 30*time.Minute)

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

type GoogleUser struct {
	ID      string `json:"sub"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
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
	return &user, nil
}
