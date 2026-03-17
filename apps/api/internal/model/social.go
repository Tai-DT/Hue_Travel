package model

import (
	"time"

	"github.com/google/uuid"
)

// ============================================
// Chat Models
// ============================================

type ChatMessage struct {
	ID           uuid.UUID `json:"id"`
	RoomID       uuid.UUID `json:"room_id"`
	SenderID     uuid.UUID `json:"sender_id"`
	SenderName   string    `json:"sender_name"`
	SenderAvatar *string   `json:"sender_avatar,omitempty"`
	Content      string    `json:"content"`
	MessageType  string    `json:"message_type"` // text, image, location, booking
	Metadata     *string   `json:"metadata,omitempty"`
	IsRead       bool      `json:"is_read"`
	CreatedAt    time.Time `json:"created_at"`
}

type ChatRoom struct {
	ID            uuid.UUID       `json:"id"`
	BookingID     *uuid.UUID      `json:"booking_id,omitempty"`
	Participants  []uuid.UUID     `json:"participants"`
	RoomType      string          `json:"room_type"` // direct, booking, group
	LastMessage   *string         `json:"last_message,omitempty"`
	LastMessageAt *time.Time      `json:"last_message_at,omitempty"`
	UnreadCount   int             `json:"unread_count"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
	OtherParticipant *ChatParticipant `json:"other_participant,omitempty"`
}

type ChatParticipant struct {
	ID        uuid.UUID `json:"id"`
	FullName  string    `json:"full_name"`
	AvatarURL *string   `json:"avatar_url,omitempty"`
	Role      string    `json:"role"`
}

// ============================================
// Friend Models
// ============================================

type Friendship struct {
	ID          uuid.UUID `json:"id"`
	RequesterID uuid.UUID `json:"requester_id"`
	AddresseeID uuid.UUID `json:"addressee_id"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type FriendInfo struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	FullName  string    `json:"full_name"`
	AvatarURL *string   `json:"avatar_url"`
	Role      string    `json:"role"`
	Level     string    `json:"level"`
	Status    string    `json:"status"`
	Since     time.Time `json:"since"`
}

// ============================================
// Trip Models
// ============================================

type Trip struct {
	ID          uuid.UUID  `json:"id"`
	CreatorID   uuid.UUID  `json:"creator_id"`
	CreatorName string     `json:"creator_name,omitempty"`
	Title       string     `json:"title"`
	Description *string    `json:"description"`
	Destination string     `json:"destination"`
	StartDate   *time.Time `json:"start_date"`
	EndDate     *time.Time `json:"end_date"`
	MaxMembers  int        `json:"max_members"`
	PlanData    []byte     `json:"plan_data"`
	CoverImage  *string    `json:"cover_image"`
	IsPublic    bool       `json:"is_public"`
	Status      string     `json:"status"`
	ChatRoomID  *uuid.UUID `json:"chat_room_id"`
	MemberCount int        `json:"member_count"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type TripMember struct {
	ID        uuid.UUID  `json:"id"`
	TripID    uuid.UUID  `json:"trip_id"`
	UserID    uuid.UUID  `json:"user_id"`
	FullName  string     `json:"full_name"`
	AvatarURL *string    `json:"avatar_url"`
	UserRole  string     `json:"user_role"`
	Role      string     `json:"role"`
	Status    string     `json:"status"`
	InvitedBy *uuid.UUID `json:"invited_by"`
	JoinedAt  *time.Time `json:"joined_at"`
	CreatedAt time.Time  `json:"created_at"`
}

// ============================================
// Reaction Models
// ============================================

type MessageReaction struct {
	ID        uuid.UUID `json:"id"`
	MessageID uuid.UUID `json:"message_id"`
	UserID    uuid.UUID `json:"user_id"`
	UserName  string    `json:"user_name"`
	Emoji     string    `json:"emoji"`
	CreatedAt time.Time `json:"created_at"`
}

type ReactionSummary struct {
	Emoji   string `json:"emoji"`
	Count   int    `json:"count"`
	Reacted bool   `json:"reacted"`
}

// ============================================
// Call Models
// ============================================

type Call struct {
	ID          uuid.UUID  `json:"id"`
	RoomID      uuid.UUID  `json:"room_id"`
	CallerID    uuid.UUID  `json:"caller_id"`
	CallerName  string     `json:"caller_name,omitempty"`
	CallType    string     `json:"call_type"`    // voice, video
	Status      string     `json:"status"`       // ringing, ongoing, ended, missed, declined
	StartedAt   *time.Time `json:"started_at"`
	EndedAt     *time.Time `json:"ended_at"`
	DurationSec int        `json:"duration_secs"`
	IsGroupCall bool       `json:"is_group_call"`
	CreatedAt   time.Time  `json:"created_at"`
}

type CallParticipant struct {
	ID       uuid.UUID  `json:"id"`
	CallID   uuid.UUID  `json:"call_id"`
	UserID   uuid.UUID  `json:"user_id"`
	UserName string     `json:"user_name,omitempty"`
	Status   string     `json:"status"` // invited, ringing, joined, left, declined
	JoinedAt *time.Time `json:"joined_at"`
	LeftAt   *time.Time `json:"left_at"`
}
