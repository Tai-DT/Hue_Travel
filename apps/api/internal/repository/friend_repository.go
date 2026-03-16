package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================
// Friend Repository
// ============================================

type FriendRepository struct {
	pool *pgxpool.Pool
}

func NewFriendRepository(pool *pgxpool.Pool) *FriendRepository {
	return &FriendRepository{pool: pool}
}

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
	Status    string    `json:"status"` // friendship status
	Since     time.Time `json:"since"`
}

// SendRequest — gửi lời kết bạn
func (r *FriendRepository) SendRequest(ctx context.Context, requesterID, addresseeID uuid.UUID) (*Friendship, error) {
	var f Friendship
	err := r.pool.QueryRow(ctx, `
		INSERT INTO friendships (requester_id, addressee_id, status)
		VALUES ($1, $2, 'pending')
		ON CONFLICT (requester_id, addressee_id) DO UPDATE 
			SET status = CASE 
				WHEN friendships.status = 'declined' THEN 'pending'
				ELSE friendships.status
			END,
			updated_at = NOW()
		RETURNING id, requester_id, addressee_id, status, created_at, updated_at
	`, requesterID, addresseeID).Scan(
		&f.ID, &f.RequesterID, &f.AddresseeID, &f.Status, &f.CreatedAt, &f.UpdatedAt,
	)
	return &f, err
}

// AcceptRequest — chấp nhận lời kết bạn
func (r *FriendRepository) AcceptRequest(ctx context.Context, friendshipID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE friendships SET status = 'accepted', updated_at = NOW()
		WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
	`, friendshipID, userID)
	return err
}

// DeclineRequest — từ chối
func (r *FriendRepository) DeclineRequest(ctx context.Context, friendshipID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE friendships SET status = 'declined', updated_at = NOW()
		WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
	`, friendshipID, userID)
	return err
}

// Unfriend — hủy kết bạn
func (r *FriendRepository) Unfriend(ctx context.Context, userID, friendID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		DELETE FROM friendships 
		WHERE (requester_id = $1 AND addressee_id = $2)
		   OR (requester_id = $2 AND addressee_id = $1)
	`, userID, friendID)
	return err
}

// ListFriends — danh sách bạn bè (accepted)
func (r *FriendRepository) ListFriends(ctx context.Context, userID uuid.UUID) ([]FriendInfo, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT f.id, 
		       CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END as friend_id,
		       u.full_name, u.avatar_url, u.role, u.level,
		       f.status, f.updated_at
		FROM friendships f
		JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
		WHERE (f.requester_id = $1 OR f.addressee_id = $1)
		  AND f.status = 'accepted'
		ORDER BY f.updated_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var friends []FriendInfo
	for rows.Next() {
		var f FriendInfo
		if err := rows.Scan(&f.ID, &f.UserID, &f.FullName, &f.AvatarURL, &f.Role, &f.Level, &f.Status, &f.Since); err != nil {
			continue
		}
		friends = append(friends, f)
	}
	return friends, nil
}

// ListPendingRequests — lời mời kết bạn đang chờ
func (r *FriendRepository) ListPendingRequests(ctx context.Context, userID uuid.UUID) ([]FriendInfo, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT f.id, f.requester_id, u.full_name, u.avatar_url, u.role, u.level,
		       f.status, f.created_at
		FROM friendships f
		JOIN users u ON u.id = f.requester_id
		WHERE f.addressee_id = $1 AND f.status = 'pending'
		ORDER BY f.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var requests []FriendInfo
	for rows.Next() {
		var f FriendInfo
		if err := rows.Scan(&f.ID, &f.UserID, &f.FullName, &f.AvatarURL, &f.Role, &f.Level, &f.Status, &f.Since); err != nil {
			continue
		}
		requests = append(requests, f)
	}
	return requests, nil
}

// GetFriendshipStatus — kiểm tra trạng thái kết bạn
func (r *FriendRepository) GetFriendshipStatus(ctx context.Context, userA, userB uuid.UUID) (*Friendship, error) {
	var f Friendship
	err := r.pool.QueryRow(ctx, `
		SELECT id, requester_id, addressee_id, status, created_at, updated_at
		FROM friendships
		WHERE (requester_id = $1 AND addressee_id = $2)
		   OR (requester_id = $2 AND addressee_id = $1)
		LIMIT 1
	`, userA, userB).Scan(&f.ID, &f.RequesterID, &f.AddresseeID, &f.Status, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// AreFriends — kiểm tra 2 user có phải bạn bè không
func (r *FriendRepository) AreFriends(ctx context.Context, userA, userB uuid.UUID) bool {
	var count int
	r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM friendships
		WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
		  AND status = 'accepted'
	`, userA, userB).Scan(&count)
	return count > 0
}
