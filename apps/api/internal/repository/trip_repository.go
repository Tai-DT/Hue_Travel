package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================
// Trip Repository — Chuyến đi chung
// ============================================

type TripRepository struct {
	pool *pgxpool.Pool
}

func NewTripRepository(pool *pgxpool.Pool) *TripRepository {
	return &TripRepository{pool: pool}
}

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

// Create — tạo chuyến đi mới
func (r *TripRepository) Create(ctx context.Context, trip *Trip) (*Trip, error) {
	err := r.pool.QueryRow(ctx, `
		INSERT INTO trips (creator_id, title, description, destination, start_date, end_date, 
		                   max_members, plan_data, cover_image, is_public, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'planning')
		RETURNING id, created_at, updated_at
	`, trip.CreatorID, trip.Title, trip.Description, trip.Destination,
		trip.StartDate, trip.EndDate, trip.MaxMembers, trip.PlanData,
		trip.CoverImage, trip.IsPublic,
	).Scan(&trip.ID, &trip.CreatedAt, &trip.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Creator tự động là thành viên
	_, err = r.pool.Exec(ctx, `
		INSERT INTO trip_members (trip_id, user_id, role, status, joined_at)
		VALUES ($1, $2, 'creator', 'accepted', NOW())
	`, trip.ID, trip.CreatorID)

	trip.Status = "planning"
	trip.MemberCount = 1
	return trip, err
}

// GetByID — lấy chi tiết chuyến đi
func (r *TripRepository) GetByID(ctx context.Context, tripID uuid.UUID) (*Trip, error) {
	var t Trip
	err := r.pool.QueryRow(ctx, `
		SELECT t.id, t.creator_id, u.full_name, t.title, t.description, t.destination,
		       t.start_date, t.end_date, t.max_members, t.plan_data, t.cover_image,
		       t.is_public, t.status, t.chat_room_id,
		       (SELECT COUNT(*) FROM trip_members tm WHERE tm.trip_id = t.id AND tm.status = 'accepted') as member_count,
		       t.created_at, t.updated_at
		FROM trips t
		JOIN users u ON u.id = t.creator_id
		WHERE t.id = $1
	`, tripID).Scan(
		&t.ID, &t.CreatorID, &t.CreatorName, &t.Title, &t.Description, &t.Destination,
		&t.StartDate, &t.EndDate, &t.MaxMembers, &t.PlanData, &t.CoverImage,
		&t.IsPublic, &t.Status, &t.ChatRoomID,
		&t.MemberCount, &t.CreatedAt, &t.UpdatedAt,
	)
	return &t, err
}

// ListByUser — chuyến đi của user
func (r *TripRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]Trip, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT t.id, t.creator_id, u.full_name, t.title, t.description, t.destination,
		       t.start_date, t.end_date, t.max_members, t.plan_data, t.cover_image,
		       t.is_public, t.status, t.chat_room_id,
		       (SELECT COUNT(*) FROM trip_members tm WHERE tm.trip_id = t.id AND tm.status = 'accepted') as member_count,
		       t.created_at, t.updated_at
		FROM trips t
		JOIN users u ON u.id = t.creator_id
		JOIN trip_members tm ON tm.trip_id = t.id
		WHERE tm.user_id = $1 AND tm.status = 'accepted'
		ORDER BY t.start_date ASC NULLS LAST, t.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trips []Trip
	for rows.Next() {
		var t Trip
		if err := rows.Scan(
			&t.ID, &t.CreatorID, &t.CreatorName, &t.Title, &t.Description, &t.Destination,
			&t.StartDate, &t.EndDate, &t.MaxMembers, &t.PlanData, &t.CoverImage,
			&t.IsPublic, &t.Status, &t.ChatRoomID,
			&t.MemberCount, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			continue
		}
		trips = append(trips, t)
	}
	return trips, nil
}

// ListPublic — chuyến đi công khai (discover)
func (r *TripRepository) ListPublic(ctx context.Context, limit, offset int) ([]Trip, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT t.id, t.creator_id, u.full_name, t.title, t.description, t.destination,
		       t.start_date, t.end_date, t.max_members, t.plan_data, t.cover_image,
		       t.is_public, t.status, t.chat_room_id,
		       (SELECT COUNT(*) FROM trip_members tm WHERE tm.trip_id = t.id AND tm.status = 'accepted') as member_count,
		       t.created_at, t.updated_at
		FROM trips t
		JOIN users u ON u.id = t.creator_id
		WHERE t.is_public = TRUE AND t.status IN ('planning', 'confirmed')
		  AND (t.start_date IS NULL OR t.start_date >= CURRENT_DATE)
		ORDER BY t.start_date ASC NULLS LAST
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trips []Trip
	for rows.Next() {
		var t Trip
		if err := rows.Scan(
			&t.ID, &t.CreatorID, &t.CreatorName, &t.Title, &t.Description, &t.Destination,
			&t.StartDate, &t.EndDate, &t.MaxMembers, &t.PlanData, &t.CoverImage,
			&t.IsPublic, &t.Status, &t.ChatRoomID,
			&t.MemberCount, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			continue
		}
		trips = append(trips, t)
	}
	return trips, nil
}

// Update — cập nhật chuyến đi
func (r *TripRepository) Update(ctx context.Context, tripID, creatorID uuid.UUID, updates map[string]interface{}) error {
	// Simple update for allowed fields
	_, err := r.pool.Exec(ctx, `
		UPDATE trips SET
			title = COALESCE($3, title),
			description = COALESCE($4, description),
			start_date = COALESCE($5, start_date),
			end_date = COALESCE($6, end_date),
			is_public = COALESCE($7, is_public),
			status = COALESCE($8, status),
			plan_data = COALESCE($9, plan_data),
			updated_at = NOW()
		WHERE id = $1 AND creator_id = $2
	`, tripID, creatorID,
		updates["title"], updates["description"],
		updates["start_date"], updates["end_date"],
		updates["is_public"], updates["status"],
		updates["plan_data"],
	)
	return err
}

// SetChatRoom — liên kết trip với chat room
func (r *TripRepository) SetChatRoom(ctx context.Context, tripID, chatRoomID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE trips SET chat_room_id = $2 WHERE id = $1
	`, tripID, chatRoomID)
	return err
}

// InviteMember — mời thành viên
func (r *TripRepository) InviteMember(ctx context.Context, tripID, userID, invitedBy uuid.UUID, role string) error {
	if role == "" {
		role = "member"
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO trip_members (trip_id, user_id, role, status, invited_by)
		VALUES ($1, $2, $3, 'invited', $4)
		ON CONFLICT (trip_id, user_id) DO UPDATE 
			SET status = 'invited', role = $3, invited_by = $4
			WHERE trip_members.status IN ('declined', 'removed')
	`, tripID, userID, role, invitedBy)
	return err
}

// AcceptInvite — chấp nhận lời mời
func (r *TripRepository) AcceptInvite(ctx context.Context, tripID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE trip_members SET status = 'accepted', joined_at = NOW()
		WHERE trip_id = $1 AND user_id = $2 AND status = 'invited'
	`, tripID, userID)
	return err
}

// DeclineInvite — từ chối lời mời
func (r *TripRepository) DeclineInvite(ctx context.Context, tripID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE trip_members SET status = 'declined'
		WHERE trip_id = $1 AND user_id = $2 AND status = 'invited'
	`, tripID, userID)
	return err
}

// JoinPublicTrip — tham gia chuyến đi public
func (r *TripRepository) JoinPublicTrip(ctx context.Context, tripID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO trip_members (trip_id, user_id, role, status, joined_at)
		SELECT $1, $2, 'member', 'accepted', NOW()
		FROM trips t
		WHERE t.id = $1 AND t.is_public = TRUE
		  AND (SELECT COUNT(*) FROM trip_members WHERE trip_id = $1 AND status = 'accepted') < t.max_members
		ON CONFLICT (trip_id, user_id) DO NOTHING
	`, tripID, userID)
	return err
}

// LeaveTrip — rời chuyến đi
func (r *TripRepository) LeaveTrip(ctx context.Context, tripID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE trip_members SET status = 'removed'
		WHERE trip_id = $1 AND user_id = $2 AND role <> 'creator'
	`, tripID, userID)
	return err
}

// ListMembers — danh sách thành viên
func (r *TripRepository) ListMembers(ctx context.Context, tripID uuid.UUID) ([]TripMember, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT tm.id, tm.trip_id, tm.user_id, u.full_name, u.avatar_url, u.role as user_role,
		       tm.role, tm.status, tm.invited_by, tm.joined_at, tm.created_at
		FROM trip_members tm
		JOIN users u ON u.id = tm.user_id
		WHERE tm.trip_id = $1 AND tm.status IN ('accepted', 'invited')
		ORDER BY tm.role = 'creator' DESC, tm.joined_at ASC
	`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []TripMember
	for rows.Next() {
		var m TripMember
		if err := rows.Scan(&m.ID, &m.TripID, &m.UserID, &m.FullName, &m.AvatarURL, &m.UserRole,
			&m.Role, &m.Status, &m.InvitedBy, &m.JoinedAt, &m.CreatedAt); err != nil {
			continue
		}
		members = append(members, m)
	}
	return members, nil
}

// IsMember — kiểm tra user có phải thành viên không
func (r *TripRepository) IsMember(ctx context.Context, tripID, userID uuid.UUID) bool {
	var count int
	r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM trip_members 
		WHERE trip_id = $1 AND user_id = $2 AND status = 'accepted'
	`, tripID, userID).Scan(&count)
	return count > 0
}

// ListUserInvitations — danh sách lời mời chuyến đi của user
func (r *TripRepository) ListUserInvitations(ctx context.Context, userID uuid.UUID) ([]Trip, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT t.id, t.creator_id, u.full_name, t.title, t.description, t.destination,
		       t.start_date, t.end_date, t.max_members, t.plan_data, t.cover_image,
		       t.is_public, t.status, t.chat_room_id,
		       (SELECT COUNT(*) FROM trip_members tm2 WHERE tm2.trip_id = t.id AND tm2.status = 'accepted'),
		       t.created_at, t.updated_at
		FROM trips t
		JOIN users u ON u.id = t.creator_id
		JOIN trip_members tm ON tm.trip_id = t.id
		WHERE tm.user_id = $1 AND tm.status = 'invited'
		ORDER BY tm.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trips []Trip
	for rows.Next() {
		var t Trip
		if err := rows.Scan(
			&t.ID, &t.CreatorID, &t.CreatorName, &t.Title, &t.Description, &t.Destination,
			&t.StartDate, &t.EndDate, &t.MaxMembers, &t.PlanData, &t.CoverImage,
			&t.IsPublic, &t.Status, &t.ChatRoomID,
			&t.MemberCount, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			continue
		}
		trips = append(trips, t)
	}
	return trips, nil
}
