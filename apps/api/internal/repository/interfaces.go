package repository

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/huetravel/api/internal/model"
)

// ============================================
// Repository Interfaces
// Cho phép mock/test mà không cần real database
// ============================================

// UserRepo defines the contract for user data access.
type UserRepo interface {
	Create(ctx context.Context, user *model.User) error
	GetByID(ctx context.Context, id uuid.UUID) (*model.User, error)
	GetByPhone(ctx context.Context, phone string) (*model.User, error)
	GetByEmail(ctx context.Context, email string) (*model.User, error)
	GetByGoogleID(ctx context.Context, googleID string) (*model.User, error)
	CreateWithGoogle(ctx context.Context, googleID, email, name, avatarURL string) (*model.User, error)
	LinkGoogleID(ctx context.Context, userID uuid.UUID, googleID, avatarURL string) error
	UpdateLastLogin(ctx context.Context, userID uuid.UUID) error
	AddXP(ctx context.Context, userID uuid.UUID, xp int) error
	UpdateProfile(ctx context.Context, userID uuid.UUID, fullName string, email, bio, avatarURL *string, languages []string) error
	ListUsers(ctx context.Context, search, role string, page, perPage int) ([]model.User, int64, error)
	SetActive(ctx context.Context, userID uuid.UUID, active bool) error
	SetRole(ctx context.Context, userID uuid.UUID, role string) error
}

// OTPRepo defines the contract for OTP data access.
type OTPRepo interface {
	Create(ctx context.Context, phone, code string, expiresAt time.Time) (*model.OTPVerification, error)
	Verify(ctx context.Context, phone, code string) (bool, error)
	CleanExpired(ctx context.Context) error
}

// ExperienceRepo defines the contract for experience data access.
type ExperienceRepo interface {
	List(ctx context.Context, filter ExperienceFilter) ([]model.Experience, int64, error)
	GetByID(ctx context.Context, id uuid.UUID) (*model.Experience, error)
	Create(ctx context.Context, exp *model.Experience) error
	Update(ctx context.Context, exp *model.Experience) error
	SoftDelete(ctx context.Context, id uuid.UUID) error
	GetOwnerID(ctx context.Context, id uuid.UUID) (uuid.UUID, error)
}

// BookingRepo defines the contract for booking data access.
type BookingRepo interface {
	Create(ctx context.Context, booking *model.Booking) error
	GetByID(ctx context.Context, id uuid.UUID) (*model.Booking, error)
	ListByTraveler(ctx context.Context, travelerID uuid.UUID, status string, page, perPage int) ([]model.Booking, int64, error)
	ListByGuide(ctx context.Context, guideID uuid.UUID, status string, page, perPage int) ([]model.Booking, int64, error)
	ListAll(ctx context.Context, status string, page, perPage int, startDate *time.Time) ([]model.Booking, int64, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status model.BookingStatus) error
	SetPayment(ctx context.Context, id uuid.UUID, method, ref string) error
	UpdatePaymentRef(ctx context.Context, id uuid.UUID, ref string) error
	GetByPaymentRef(ctx context.Context, ref string) (*model.Booking, error)
	UpdatePaymentInfo(ctx context.Context, id uuid.UUID, transactionNo string, paidAt *time.Time) error
}

// ReviewRepo defines the contract for review data access.
type ReviewRepo interface {
	Create(ctx context.Context, review *model.Review) error
	ListByExperience(ctx context.Context, experienceID uuid.UUID, page, perPage int) ([]model.Review, int64, error)
	GetReviewSummary(ctx context.Context, experienceID uuid.UUID) (*ReviewSummary, error)
	ListAdmin(ctx context.Context, filter AdminReviewFilter) ([]AdminReviewItem, int64, error)
	SetFeatured(ctx context.Context, reviewID uuid.UUID, featured bool) error
	DeleteAdmin(ctx context.Context, reviewID uuid.UUID) error
}

// FavoriteRepo defines the contract for favorite data access.
type FavoriteRepo interface {
	Toggle(ctx context.Context, userID, experienceID uuid.UUID) (bool, error)
	ListByUser(ctx context.Context, userID uuid.UUID, page, perPage int) ([]model.Experience, int64, error)
	IsFavorited(ctx context.Context, userID, experienceID uuid.UUID) (bool, error)
}

// GuideProfileRepo defines the contract for guide profile data access.
type GuideProfileRepo interface {
	GetByUserID(ctx context.Context, userID uuid.UUID) (*model.GuideProfile, error)
	GetTopGuides(ctx context.Context, limit int) ([]model.GuideProfile, error)
	CreateOrUpdate(ctx context.Context, gp *model.GuideProfile) error
}

// ChatRepo defines the contract for chat data access.
type ChatRepo interface {
	CreateRoom(ctx context.Context, roomType string, participants []uuid.UUID, bookingID *uuid.UUID) (*ChatRoom, error)
	GetOrCreateDirectRoom(ctx context.Context, userA, userB uuid.UUID) (*ChatRoom, error)
	ListRooms(ctx context.Context, userID uuid.UUID) ([]ChatRoom, error)
	SendMessage(ctx context.Context, roomID, senderID uuid.UUID, content, messageType string, metadata *string) (*ChatMessage, error)
	GetMessages(ctx context.Context, roomID uuid.UUID, limit, offset int) ([]ChatMessage, error)
	MarkAsRead(ctx context.Context, roomID, userID uuid.UUID) error
}

// ============================================
// Compile-time interface compliance checks
// ============================================

var _ UserRepo = (*UserRepository)(nil)
var _ OTPRepo = (*OTPRepository)(nil)
var _ ExperienceRepo = (*ExperienceRepository)(nil)
var _ BookingRepo = (*BookingRepository)(nil)
var _ ReviewRepo = (*ReviewRepository)(nil)
var _ FavoriteRepo = (*FavoriteRepository)(nil)
var _ GuideProfileRepo = (*GuideProfileRepository)(nil)
var _ ChatRepo = (*ChatRepository)(nil)
