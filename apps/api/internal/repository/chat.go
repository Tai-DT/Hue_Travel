package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================
// Chat Repository
// ============================================

type ChatMessage struct {
	ID           uuid.UUID  `json:"id"`
	RoomID       uuid.UUID  `json:"room_id"`
	SenderID     uuid.UUID  `json:"sender_id"`
	SenderName   string     `json:"sender_name"`
	SenderAvatar *string    `json:"sender_avatar,omitempty"`
	Content      string     `json:"content"`
	MessageType  string     `json:"message_type"` // text, image, location, booking
	Metadata     *string    `json:"metadata,omitempty"`
	IsRead       bool       `json:"is_read"`
	CreatedAt    time.Time  `json:"created_at"`
}

type ChatRoom struct {
	ID            uuid.UUID    `json:"id"`
	BookingID     *uuid.UUID   `json:"booking_id,omitempty"`
	Participants  []uuid.UUID  `json:"participants"`
	RoomType      string       `json:"room_type"` // direct, booking, group
	LastMessage   *string      `json:"last_message,omitempty"`
	LastMessageAt *time.Time   `json:"last_message_at,omitempty"`
	UnreadCount   int          `json:"unread_count"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`

	// Joined
	OtherParticipant *ChatParticipant `json:"other_participant,omitempty"`
}

type ChatParticipant struct {
	ID        uuid.UUID `json:"id"`
	FullName  string    `json:"full_name"`
	AvatarURL *string   `json:"avatar_url,omitempty"`
	Role      string    `json:"role"`
}

type ChatRepository struct {
	pool *pgxpool.Pool
}

func NewChatRepository(pool *pgxpool.Pool) *ChatRepository {
	return &ChatRepository{pool: pool}
}

// ---- Room Management ----

func (r *ChatRepository) CreateRoom(ctx context.Context, roomType string, participants []uuid.UUID, bookingID *uuid.UUID) (*ChatRoom, error) {
	room := &ChatRoom{
		ID:           uuid.New(),
		BookingID:    bookingID,
		Participants: participants,
		RoomType:     roomType,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO chat_rooms (id, booking_id, participants, room_type, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		room.ID, room.BookingID, room.Participants, room.RoomType,
		room.CreatedAt, room.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return room, nil
}

func (r *ChatRepository) GetOrCreateDirectRoom(ctx context.Context, userA, userB uuid.UUID) (*ChatRoom, error) {
	// Check if room already exists between these two users
	var room ChatRoom
	err := r.pool.QueryRow(ctx, `
		SELECT id, booking_id, participants, room_type, last_message, last_message_at, created_at, updated_at
		FROM chat_rooms
		WHERE room_type = 'direct'
			AND $1 = ANY(participants)
			AND $2 = ANY(participants)
		LIMIT 1`, userA, userB,
	).Scan(
		&room.ID, &room.BookingID, &room.Participants, &room.RoomType,
		&room.LastMessage, &room.LastMessageAt, &room.CreatedAt, &room.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return r.CreateRoom(ctx, "direct", []uuid.UUID{userA, userB}, nil)
	}
	if err != nil {
		return nil, err
	}
	return &room, nil
}

func (r *ChatRepository) ListRooms(ctx context.Context, userID uuid.UUID) ([]ChatRoom, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT cr.id, cr.booking_id, cr.participants, cr.room_type,
			   cr.last_message, cr.last_message_at, cr.created_at, cr.updated_at
		FROM chat_rooms cr
		WHERE $1 = ANY(cr.participants)
		ORDER BY COALESCE(cr.last_message_at, cr.created_at) DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rooms []ChatRoom
	for rows.Next() {
		var room ChatRoom
		err := rows.Scan(
			&room.ID, &room.BookingID, &room.Participants, &room.RoomType,
			&room.LastMessage, &room.LastMessageAt, &room.CreatedAt, &room.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Get the other participant's info
		for _, pid := range room.Participants {
			if pid != userID {
				var p ChatParticipant
				r.pool.QueryRow(ctx,
					`SELECT id, full_name, avatar_url, role FROM users WHERE id = $1`, pid,
				).Scan(&p.ID, &p.FullName, &p.AvatarURL, &p.Role)
				room.OtherParticipant = &p
				break
			}
		}

		// Count unread messages
		r.pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM chat_messages
			 WHERE room_id = $1 AND sender_id != $2 AND is_read = FALSE`,
			room.ID, userID,
		).Scan(&room.UnreadCount)

		rooms = append(rooms, room)
	}
	return rooms, nil
}

// ---- Messages ----

func (r *ChatRepository) SendMessage(ctx context.Context, roomID, senderID uuid.UUID, content, messageType string, metadata *string) (*ChatMessage, error) {
	msg := &ChatMessage{
		ID:          uuid.New(),
		RoomID:      roomID,
		SenderID:    senderID,
		Content:     content,
		MessageType: messageType,
		Metadata:    metadata,
		IsRead:      false,
		CreatedAt:   time.Now(),
	}

	// Get sender info
	r.pool.QueryRow(ctx,
		`SELECT full_name, avatar_url FROM users WHERE id = $1`, senderID,
	).Scan(&msg.SenderName, &msg.SenderAvatar)

	_, err := r.pool.Exec(ctx, `
		INSERT INTO chat_messages (id, room_id, sender_id, content, message_type, metadata, is_read, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		msg.ID, msg.RoomID, msg.SenderID, msg.Content, msg.MessageType,
		msg.Metadata, msg.IsRead, msg.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Update room's last message
	_, _ = r.pool.Exec(ctx, `
		UPDATE chat_rooms SET last_message = $1, last_message_at = $2, updated_at = $2
		WHERE id = $3`,
		content, msg.CreatedAt, roomID,
	)

	return msg, nil
}

func (r *ChatRepository) GetMessages(ctx context.Context, roomID uuid.UUID, limit, offset int) ([]ChatMessage, error) {
	if limit <= 0 || limit > 50 {
		limit = 30
	}

	rows, err := r.pool.Query(ctx, `
		SELECT m.id, m.room_id, m.sender_id, m.content, m.message_type,
			   m.metadata, m.is_read, m.created_at,
			   u.full_name, u.avatar_url
		FROM chat_messages m
		JOIN users u ON m.sender_id = u.id
		WHERE m.room_id = $1
		ORDER BY m.created_at DESC
		LIMIT $2 OFFSET $3`, roomID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []ChatMessage
	for rows.Next() {
		var msg ChatMessage
		err := rows.Scan(
			&msg.ID, &msg.RoomID, &msg.SenderID, &msg.Content, &msg.MessageType,
			&msg.Metadata, &msg.IsRead, &msg.CreatedAt,
			&msg.SenderName, &msg.SenderAvatar,
		)
		if err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}
	return messages, nil
}

func (r *ChatRepository) MarkAsRead(ctx context.Context, roomID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE chat_messages SET is_read = TRUE
		WHERE room_id = $1 AND sender_id != $2 AND is_read = FALSE`,
		roomID, userID,
	)
	return err
}
