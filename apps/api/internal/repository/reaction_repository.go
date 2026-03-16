package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================
// Message Reaction Repository
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
	Emoji string `json:"emoji"`
	Count int    `json:"count"`
	Reacted bool `json:"reacted"` // current user reacted?
}

type ReactionRepository struct {
	pool *pgxpool.Pool
}

func NewReactionRepository(pool *pgxpool.Pool) *ReactionRepository {
	return &ReactionRepository{pool: pool}
}

// ToggleReaction — thêm/xoá reaction (toggle)
func (r *ReactionRepository) ToggleReaction(ctx context.Context, messageID, userID uuid.UUID, emoji string) (bool, error) {
	// Check if already exists
	var exists bool
	r.pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM message_reactions 
		WHERE message_id = $1 AND user_id = $2 AND emoji = $3)
	`, messageID, userID, emoji).Scan(&exists)

	if exists {
		_, err := r.pool.Exec(ctx, `
			DELETE FROM message_reactions 
			WHERE message_id = $1 AND user_id = $2 AND emoji = $3
		`, messageID, userID, emoji)
		return false, err // removed
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO message_reactions (message_id, user_id, emoji)
		VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING
	`, messageID, userID, emoji)
	return true, err // added
}

// GetReactions — danh sách reactions cho 1 tin nhắn
func (r *ReactionRepository) GetReactions(ctx context.Context, messageID uuid.UUID) ([]MessageReaction, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT mr.id, mr.message_id, mr.user_id, u.full_name, mr.emoji, mr.created_at
		FROM message_reactions mr
		JOIN users u ON u.id = mr.user_id
		WHERE mr.message_id = $1
		ORDER BY mr.created_at ASC
	`, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reactions []MessageReaction
	for rows.Next() {
		var r MessageReaction
		if err := rows.Scan(&r.ID, &r.MessageID, &r.UserID, &r.UserName, &r.Emoji, &r.CreatedAt); err != nil {
			continue
		}
		reactions = append(reactions, r)
	}
	return reactions, nil
}

// GetReactionSummary — tóm tắt reactions (emoji + count)
func (r *ReactionRepository) GetReactionSummary(ctx context.Context, messageID, currentUserID uuid.UUID) ([]ReactionSummary, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT mr.emoji, 
		       COUNT(*) as count,
		       BOOL_OR(mr.user_id = $2) as reacted
		FROM message_reactions mr
		WHERE mr.message_id = $1
		GROUP BY mr.emoji
		ORDER BY count DESC
	`, messageID, currentUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []ReactionSummary
	for rows.Next() {
		var s ReactionSummary
		if err := rows.Scan(&s.Emoji, &s.Count, &s.Reacted); err != nil {
			continue
		}
		summaries = append(summaries, s)
	}
	return summaries, nil
}
