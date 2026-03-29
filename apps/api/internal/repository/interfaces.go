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
	GetByEmail(ctx context.Context, email string) (*model.User, error)
	UpdateLastLogin(ctx context.Context, userID uuid.UUID) error
	UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string) error
	AddXP(ctx context.Context, userID uuid.UUID, xp int) error
	UpdateProfile(ctx context.Context, userID uuid.UUID, fullName string, email, bio, avatarURL *string, languages []string) error
	ListUsers(ctx context.Context, search, role string, page, perPage int) ([]model.User, int64, error)
	SetActive(ctx context.Context, userID uuid.UUID, active bool) error
	SetRole(ctx context.Context, userID uuid.UUID, role string) error
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

// FriendRepo defines the contract for friend/connection data access.
type FriendRepo interface {
	SendRequest(ctx context.Context, requesterID, addresseeID uuid.UUID) (*Friendship, error)
	AcceptRequest(ctx context.Context, friendshipID, userID uuid.UUID) error
	DeclineRequest(ctx context.Context, friendshipID, userID uuid.UUID) error
	Unfriend(ctx context.Context, userID, friendID uuid.UUID) error
	ListFriends(ctx context.Context, userID uuid.UUID) ([]FriendInfo, error)
	ListPendingRequests(ctx context.Context, userID uuid.UUID) ([]FriendInfo, error)
	GetFriendshipStatus(ctx context.Context, userA, userB uuid.UUID) (*Friendship, error)
	AreFriends(ctx context.Context, userA, userB uuid.UUID) bool
}

// TripRepo defines the contract for shared trip data access.
type TripRepo interface {
	Create(ctx context.Context, trip *Trip) (*Trip, error)
	GetByID(ctx context.Context, tripID uuid.UUID) (*Trip, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]Trip, error)
	ListPublic(ctx context.Context, limit, offset int) ([]Trip, error)
	Update(ctx context.Context, tripID, creatorID uuid.UUID, updates map[string]interface{}) error
	SetChatRoom(ctx context.Context, tripID, chatRoomID uuid.UUID) error
	InviteMember(ctx context.Context, tripID, userID, invitedBy uuid.UUID, role string) error
	AcceptInvite(ctx context.Context, tripID, userID uuid.UUID) error
	DeclineInvite(ctx context.Context, tripID, userID uuid.UUID) error
	JoinPublicTrip(ctx context.Context, tripID, userID uuid.UUID) error
	LeaveTrip(ctx context.Context, tripID, userID uuid.UUID) error
	ListMembers(ctx context.Context, tripID uuid.UUID) ([]TripMember, error)
	IsMember(ctx context.Context, tripID, userID uuid.UUID) bool
	ListUserInvitations(ctx context.Context, userID uuid.UUID) ([]Trip, error)
}

// ReactionRepo defines the contract for message reaction data access.
type ReactionRepo interface {
	ToggleReaction(ctx context.Context, messageID, userID uuid.UUID, emoji string) (bool, error)
	GetReactions(ctx context.Context, messageID uuid.UUID) ([]MessageReaction, error)
	GetReactionSummary(ctx context.Context, messageID, currentUserID uuid.UUID) ([]ReactionSummary, error)
}

// PromotionRepo defines the contract for promotion/coupon data access.
type PromotionRepo interface {
	Create(ctx context.Context, p *Promotion) error
	ListActive(ctx context.Context) ([]Promotion, error)
	GetByCode(ctx context.Context, code string) (*Promotion, error)
	ApplyPromotion(ctx context.Context, code string, userID uuid.UUID, orderAmount int64) (int64, *Promotion, error)
	GetUserCoupons(ctx context.Context, userID uuid.UUID) ([]Promotion, error)
}

// GamificationRepo defines the contract for gamification data access.
type GamificationRepo interface {
	ListAchievements(ctx context.Context, userID *uuid.UUID) ([]Achievement, error)
	GetUserAchievements(ctx context.Context, userID uuid.UUID) ([]Achievement, error)
	AwardAchievement(ctx context.Context, userID, achievementID uuid.UUID) (bool, error)
	AddXP(ctx context.Context, userID uuid.UUID, xp int)
	CheckIn(ctx context.Context, ci *CheckIn) error
	GetCheckins(ctx context.Context, userID uuid.UUID, limit int) ([]CheckIn, error)
	GetLeaderboard(ctx context.Context, limit int) ([]LeaderboardEntry, error)
	GetUserStats(ctx context.Context, userID uuid.UUID) (map[string]interface{}, error)
}

// BlogRepo defines the contract for blog data access.
type BlogRepo interface {
	Create(ctx context.Context, post *BlogPost) error
	ListPublished(ctx context.Context, category string, page, perPage int) ([]BlogPost, int64, error)
	GetBySlug(ctx context.Context, slug string) (*BlogPost, error)
	ToggleLike(ctx context.Context, blogID, userID uuid.UUID) (bool, error)
	AddComment(ctx context.Context, blogID, userID uuid.UUID, content string) (*BlogComment, error)
	ListComments(ctx context.Context, blogID uuid.UUID) ([]BlogComment, error)
	GetTrending(ctx context.Context, limit int) ([]BlogPost, error)
}

// DiaryRepo defines the contract for travel diary data access.
type DiaryRepo interface {
	Create(ctx context.Context, entry *DiaryEntry) error
	ListByUser(ctx context.Context, userID uuid.UUID, limit int) ([]DiaryEntry, error)
	ListPublic(ctx context.Context, limit int) ([]DiaryEntry, error)
}

// EventRepo defines the contract for local event data access.
type EventRepo interface {
	ListUpcoming(ctx context.Context, category string, limit int) ([]LocalEvent, error)
	GetByID(ctx context.Context, id uuid.UUID) (*LocalEvent, error)
	RSVP(ctx context.Context, eventID, userID uuid.UUID, status string) error
}

// SOSRepo defines the contract for SOS alert data access.
type SOSRepo interface {
	CreateAlert(ctx context.Context, alert *SOSAlert) error
	CancelAlert(ctx context.Context, alertID, userID uuid.UUID) error
	GetActive(ctx context.Context, userID uuid.UUID) (*SOSAlert, error)
}

// ReportBlockRepo defines the contract for report and user block data access.
type ReportBlockRepo interface {
	CreateReport(ctx context.Context, report *Report) error
	ListReports(ctx context.Context, status string) ([]Report, error)
	BlockUser(ctx context.Context, blockerID, blockedID uuid.UUID) error
	UnblockUser(ctx context.Context, blockerID, blockedID uuid.UUID) error
	ListBlocked(ctx context.Context, userID uuid.UUID) ([]BlockedUser, error)
	IsBlocked(ctx context.Context, userA, userB uuid.UUID) bool
}

// GuideAppRepo defines the contract for guide application data access.
type GuideAppRepo interface {
	Create(ctx context.Context, app *GuideApplication) error
	ListPending(ctx context.Context) ([]GuideApplication, error)
	GetMyApplication(ctx context.Context, userID uuid.UUID) (*GuideApplication, error)
	Approve(ctx context.Context, appID uuid.UUID, note string) error
	Reject(ctx context.Context, appID uuid.UUID, note string) error
}

// StoryRepo defines the contract for story/feed data access.
type StoryRepo interface {
	Create(ctx context.Context, s *Story) error
	Feed(ctx context.Context, viewerID uuid.UUID, limit, offset int) ([]Story, error)
	ToggleLike(ctx context.Context, storyID, userID uuid.UUID) (bool, error)
	AddComment(ctx context.Context, c *StoryComment) error
	ListComments(ctx context.Context, storyID uuid.UUID) ([]StoryComment, error)
	Delete(ctx context.Context, storyID, userID uuid.UUID) error
}

// CollectionRepo defines the contract for bookmark collection data access.
type CollectionRepo interface {
	Create(ctx context.Context, c *Collection) error
	ListByUser(ctx context.Context, userID uuid.UUID) ([]Collection, error)
	AddItem(ctx context.Context, item *CollectionItem) error
	RemoveItem(ctx context.Context, collectionID, itemID uuid.UUID) error
	GetItems(ctx context.Context, collectionID uuid.UUID) ([]CollectionItem, error)
	Delete(ctx context.Context, collectionID, userID uuid.UUID) error
}

// ============================================
// Compile-time interface compliance checks
// ============================================

var _ UserRepo = (*UserRepository)(nil)
var _ ExperienceRepo = (*ExperienceRepository)(nil)
var _ BookingRepo = (*BookingRepository)(nil)
var _ ReviewRepo = (*ReviewRepository)(nil)
var _ FavoriteRepo = (*FavoriteRepository)(nil)
var _ GuideProfileRepo = (*GuideProfileRepository)(nil)
var _ ChatRepo = (*ChatRepository)(nil)
var _ FriendRepo = (*FriendRepository)(nil)
var _ TripRepo = (*TripRepository)(nil)
var _ ReactionRepo = (*ReactionRepository)(nil)
var _ PromotionRepo = (*PromotionRepository)(nil)
var _ GamificationRepo = (*GamificationRepository)(nil)
var _ BlogRepo = (*BlogRepository)(nil)
var _ DiaryRepo = (*DiaryRepository)(nil)
var _ EventRepo = (*EventRepository)(nil)
var _ SOSRepo = (*SOSRepository)(nil)
var _ ReportBlockRepo = (*ReportBlockRepository)(nil)
var _ GuideAppRepo = (*GuideAppRepository)(nil)
var _ StoryRepo = (*StoryRepository)(nil)
var _ CollectionRepo = (*CollectionRepository)(nil)
