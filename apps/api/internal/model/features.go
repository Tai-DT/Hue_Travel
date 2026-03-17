package model

import (
	"time"

	"github.com/google/uuid"
)

// ============================================
// Event Models
// ============================================

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

// ============================================
// SOS Models
// ============================================

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

// ============================================
// Gamification Models
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

// ============================================
// Promotion Models
// ============================================

type Promotion struct {
	ID            uuid.UUID  `json:"id"`
	Code          string     `json:"code"`
	Title         string     `json:"title"`
	Description   *string    `json:"description"`
	DiscountType  string     `json:"discount_type"`
	DiscountValue int64      `json:"discount_value"`
	MinOrder      int64      `json:"min_order"`
	MaxDiscount   *int64     `json:"max_discount"`
	UsageLimit    int        `json:"usage_limit"`
	UsedCount     int        `json:"used_count"`
	PerUserLimit  int        `json:"per_user_limit"`
	ExperienceID  *uuid.UUID `json:"experience_id"`
	CreatorID     *uuid.UUID `json:"creator_id"`
	IsFlashSale   bool       `json:"is_flash_sale"`
	IsActive      bool       `json:"is_active"`
	StartsAt      time.Time  `json:"starts_at"`
	ExpiresAt     time.Time  `json:"expires_at"`
	CreatedAt     time.Time  `json:"created_at"`
}

// ============================================
// Report & Block Models
// ============================================

type Report struct {
	ID          uuid.UUID `json:"id"`
	ReporterID  uuid.UUID `json:"reporter_id"`
	TargetType  string    `json:"target_type"`
	TargetID    uuid.UUID `json:"target_id"`
	Reason      string    `json:"reason"`
	Description *string   `json:"description"`
	Status      string    `json:"status"`
	AdminNote   *string   `json:"admin_note,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type BlockedUser struct {
	ID        uuid.UUID `json:"id"`
	BlockerID uuid.UUID `json:"blocker_id"`
	BlockedID uuid.UUID `json:"blocked_id"`
	CreatedAt time.Time `json:"created_at"`
}

// ============================================
// Guide Application Models
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

// ============================================
// Review Summary Models (used by admin/reports)
// ============================================

type ReviewSummary struct {
	TotalReviews   int64   `json:"total_reviews"`
	AverageOverall float64 `json:"average_overall"`
	AverageGuide   float64 `json:"average_guide"`
	AverageValue   float64 `json:"average_value"`
	Star5          int64   `json:"star_5"`
	Star4          int64   `json:"star_4"`
	Star3          int64   `json:"star_3"`
	Star2          int64   `json:"star_2"`
	Star1          int64   `json:"star_1"`
}

// ============================================
// Experience Filter (used by repo queries)
// ============================================

type ExperienceFilter struct {
	Category        string
	MinPrice        int64
	MaxPrice        int64
	GuideID         *uuid.UUID
	Search          string
	Page            int
	PerPage         int
	SortBy          string // "rating", "price_asc", "price_desc", "newest"
	IncludeInactive bool   // admin: include soft-deleted experiences
}
