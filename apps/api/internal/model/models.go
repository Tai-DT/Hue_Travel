package model

import (
	"time"

	"github.com/google/uuid"
)

// ============================================
// User & Auth Models
// ============================================

type UserRole string

const (
	RoleTraveler UserRole = "traveler"
	RoleGuide    UserRole = "guide"
	RoleBlogger  UserRole = "blogger"
	RoleMerchant UserRole = "merchant"
	RoleExpert   UserRole = "expert"
	RoleAdmin    UserRole = "admin"
)

type User struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	Phone        *string    `json:"phone,omitempty" db:"phone"`
	Email        *string    `json:"email,omitempty" db:"email"`
	PasswordHash *string    `json:"-" db:"password_hash"`
	FullName     string     `json:"full_name" db:"full_name"`
	AvatarURL    *string    `json:"avatar_url,omitempty" db:"avatar_url"`
	Role         UserRole   `json:"role" db:"role"`
	Bio          *string    `json:"bio,omitempty" db:"bio"`
	Languages    []string   `json:"languages,omitempty" db:"languages"`
	XP           int        `json:"xp" db:"xp"`
	Level        string     `json:"level" db:"level"`
	IsVerified   bool       `json:"is_verified" db:"is_verified"`
	IsActive     bool       `json:"is_active" db:"is_active"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty" db:"last_login_at"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
}

type OTPVerification struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Phone     string    `json:"phone" db:"phone"`
	Code      string    `json:"-" db:"code"`
	ExpiresAt time.Time `json:"expires_at" db:"expires_at"`
	Verified  bool      `json:"verified" db:"verified"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// ============================================
// Category & Place Models
// ============================================

type CategoryType string

const (
	CatStay       CategoryType = "stay"
	CatFood       CategoryType = "food"
	CatExperience CategoryType = "experience"
	CatTour       CategoryType = "tour"
	CatSight      CategoryType = "sightseeing"
	CatTransport  CategoryType = "transport"
)

type Place struct {
	ID            uuid.UUID    `json:"id" db:"id"`
	Name          string       `json:"name" db:"name"`
	NameEN        *string      `json:"name_en,omitempty" db:"name_en"`
	Description   *string      `json:"description,omitempty" db:"description"`
	Category      CategoryType `json:"category" db:"category"`
	Address       string       `json:"address" db:"address"`
	Lat           float64      `json:"lat" db:"lat"`
	Lng           float64      `json:"lng" db:"lng"`
	GooglePlaceID *string      `json:"google_place_id,omitempty" db:"google_place_id"`
	Phone         *string      `json:"phone,omitempty" db:"phone"`
	Website       *string      `json:"website,omitempty" db:"website"`
	PriceRange    *string      `json:"price_range,omitempty" db:"price_range"`
	Rating        float64      `json:"rating" db:"rating"`
	RatingCount   int          `json:"rating_count" db:"rating_count"`
	OpeningHours  *string      `json:"opening_hours,omitempty" db:"opening_hours"`
	ImageURLs     []string     `json:"image_urls,omitempty" db:"image_urls"`
	Tags          []string     `json:"tags,omitempty" db:"tags"`
	IsActive      bool         `json:"is_active" db:"is_active"`
	CreatedAt     time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at" db:"updated_at"`
}

// ============================================
// Experience / Offering Models
// ============================================

type Experience struct {
	ID           uuid.UUID    `json:"id" db:"id"`
	GuideID      uuid.UUID    `json:"guide_id" db:"guide_id"`
	Title        string       `json:"title" db:"title"`
	Description  string       `json:"description" db:"description"`
	Category     CategoryType `json:"category" db:"category"`
	Price        int64        `json:"price" db:"price"` // VND
	MaxGuests    int          `json:"max_guests" db:"max_guests"`
	DurationMins int          `json:"duration_mins" db:"duration_mins"`
	MeetingPoint string       `json:"meeting_point" db:"meeting_point"`
	MeetingLat   float64      `json:"meeting_lat" db:"meeting_lat"`
	MeetingLng   float64      `json:"meeting_lng" db:"meeting_lng"`
	Includes     []string     `json:"includes,omitempty" db:"includes"`
	Highlights   []string     `json:"highlights,omitempty" db:"highlights"`
	ImageURLs    []string     `json:"image_urls,omitempty" db:"image_urls"`
	Rating       float64      `json:"rating" db:"rating"`
	RatingCount  int          `json:"rating_count" db:"rating_count"`
	IsInstant    bool         `json:"is_instant" db:"is_instant"` // instant booking vs manual confirm
	IsActive     bool         `json:"is_active" db:"is_active"`
	CreatedAt    time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at" db:"updated_at"`

	// Joined fields
	Guide *User `json:"guide,omitempty" db:"-"`
}

// ============================================
// Booking Models
// ============================================

type BookingStatus string

const (
	BookingPending   BookingStatus = "pending"
	BookingConfirmed BookingStatus = "confirmed"
	BookingActive    BookingStatus = "active"
	BookingCompleted BookingStatus = "completed"
	BookingCancelled BookingStatus = "cancelled"
	BookingRefunded  BookingStatus = "refunded"
)

type Booking struct {
	ID            uuid.UUID     `json:"id" db:"id"`
	TravelerID    uuid.UUID     `json:"traveler_id" db:"traveler_id"`
	ExperienceID  uuid.UUID     `json:"experience_id" db:"experience_id"`
	GuideID       uuid.UUID     `json:"guide_id" db:"guide_id"`
	BookingDate   time.Time     `json:"booking_date" db:"booking_date"`
	StartTime     string        `json:"start_time" db:"start_time"` // "19:00"
	GuestCount    int           `json:"guest_count" db:"guest_count"`
	TotalPrice    int64         `json:"total_price" db:"total_price"` // VND
	ServiceFee    int64         `json:"service_fee" db:"service_fee"` // 5%
	Status        BookingStatus `json:"status" db:"status"`
	SpecialNotes  *string       `json:"special_notes,omitempty" db:"special_notes"`
	CancelReason  *string       `json:"cancel_reason,omitempty" db:"cancel_reason"`
	PaymentMethod *string       `json:"payment_method,omitempty" db:"payment_method"`
	PaymentRef    *string       `json:"payment_ref,omitempty" db:"payment_ref"`
	PaidAt        *time.Time    `json:"paid_at,omitempty" db:"paid_at"`
	ConfirmedAt   *time.Time    `json:"confirmed_at,omitempty" db:"confirmed_at"`
	CompletedAt   *time.Time    `json:"completed_at,omitempty" db:"completed_at"`
	CreatedAt     time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at" db:"updated_at"`

	// Joined
	Experience *Experience `json:"experience,omitempty" db:"-"`
	Traveler   *User       `json:"traveler,omitempty" db:"-"`
}

// ============================================
// Review Models
// ============================================

type Review struct {
	ID            uuid.UUID `json:"id" db:"id"`
	BookingID     uuid.UUID `json:"booking_id" db:"booking_id"`
	TravelerID    uuid.UUID `json:"traveler_id" db:"traveler_id"`
	ExperienceID  uuid.UUID `json:"experience_id" db:"experience_id"`
	OverallRating float64   `json:"overall_rating" db:"overall_rating"`
	GuideRating   float64   `json:"guide_rating" db:"guide_rating"`
	ValueRating   float64   `json:"value_rating" db:"value_rating"`
	Comment       *string   `json:"comment,omitempty" db:"comment"`
	PhotoURLs     []string  `json:"photo_urls,omitempty" db:"photo_urls"`
	IsFeatured    bool      `json:"is_featured" db:"is_featured"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`

	Traveler *User `json:"traveler,omitempty" db:"-"`
}

// ============================================
// Guide Profile Models
// ============================================

type GuideProfile struct {
	ID              uuid.UUID `json:"id" db:"id"`
	UserID          uuid.UUID `json:"user_id" db:"user_id"`
	BadgeLevel      string    `json:"badge_level" db:"badge_level"` // bronze, silver, gold, platinum
	Specialties     []string  `json:"specialties,omitempty" db:"specialties"`
	ExperienceYears int       `json:"experience_years" db:"experience_years"`
	TotalTours      int       `json:"total_tours" db:"total_tours"`
	TotalReviews    int       `json:"total_reviews" db:"total_reviews"`
	AvgRating       float64   `json:"avg_rating" db:"avg_rating"`
	ResponseTimeMins int      `json:"response_time_mins" db:"response_time_mins"`
	AcceptanceRate  float64   `json:"acceptance_rate" db:"acceptance_rate"`
	IsApproved      bool      `json:"is_approved" db:"is_approved"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`

	User *User `json:"user,omitempty" db:"-"`
}
