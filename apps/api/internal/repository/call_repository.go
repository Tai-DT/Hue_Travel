package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================
// Call Repository — Voice & Video Calls
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
	DurationSec int       `json:"duration_secs"`
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

type CallRepository struct {
	pool *pgxpool.Pool
}

func NewCallRepository(pool *pgxpool.Pool) *CallRepository {
	return &CallRepository{pool: pool}
}

// InitiateCall — bắt đầu cuộc gọi
func (r *CallRepository) InitiateCall(ctx context.Context, roomID, callerID uuid.UUID, callType string, isGroup bool) (*Call, error) {
	call := &Call{
		ID:          uuid.New(),
		RoomID:      roomID,
		CallerID:    callerID,
		CallType:    callType,
		Status:      "ringing",
		IsGroupCall: isGroup,
		CreatedAt:   time.Now(),
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO calls (id, room_id, caller_id, call_type, status, is_group_call, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, call.ID, call.RoomID, call.CallerID, call.CallType, call.Status, call.IsGroupCall, call.CreatedAt)
	if err != nil {
		return nil, err
	}

	// Get caller name
	r.pool.QueryRow(ctx, `SELECT full_name FROM users WHERE id = $1`, callerID).Scan(&call.CallerName)

	// Add caller as participant
	_, _ = r.pool.Exec(ctx, `
		INSERT INTO call_participants (call_id, user_id, status, joined_at)
		VALUES ($1, $2, 'joined', NOW())
	`, call.ID, callerID)

	return call, nil
}

// AddParticipants — thêm participants cho cuộc gọi (invite)
func (r *CallRepository) AddParticipants(ctx context.Context, callID uuid.UUID, userIDs []uuid.UUID) error {
	for _, uid := range userIDs {
		_, _ = r.pool.Exec(ctx, `
			INSERT INTO call_participants (call_id, user_id, status)
			VALUES ($1, $2, 'invited')
			ON CONFLICT (call_id, user_id) DO NOTHING
		`, callID, uid)
	}
	return nil
}

// AnswerCall — user trả lời cuộc gọi
func (r *CallRepository) AnswerCall(ctx context.Context, callID, userID uuid.UUID) error {
	// Update the participant
	_, err := r.pool.Exec(ctx, `
		UPDATE call_participants SET status = 'joined', joined_at = NOW()
		WHERE call_id = $1 AND user_id = $2
	`, callID, userID)
	if err != nil {
		return err
	}

	// Start the call if not already started
	_, err = r.pool.Exec(ctx, `
		UPDATE calls SET status = 'ongoing', started_at = NOW()
		WHERE id = $1 AND status = 'ringing'
	`, callID)
	return err
}

// DeclineCall — từ chối cuộc gọi
func (r *CallRepository) DeclineCall(ctx context.Context, callID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE call_participants SET status = 'declined'
		WHERE call_id = $1 AND user_id = $2
	`, callID, userID)
	if err != nil {
		return err
	}

	// Nếu cuộc gọi 1-1, cập nhật trạng thái cuộc gọi
	var isGroup bool
	var joinedCount int
	r.pool.QueryRow(ctx, `SELECT is_group_call FROM calls WHERE id = $1`, callID).Scan(&isGroup)

	if !isGroup {
		_, _ = r.pool.Exec(ctx, `
			UPDATE calls SET status = 'declined', ended_at = NOW()
			WHERE id = $1 AND status = 'ringing'
		`, callID)
	} else {
		// Với group call, kiểm tra nếu tất cả đã decline
		r.pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM call_participants 
			WHERE call_id = $1 AND status = 'joined'
		`, callID).Scan(&joinedCount)

		if joinedCount <= 1 { // chỉ còn caller
			_, _ = r.pool.Exec(ctx, `
				UPDATE calls SET status = 'declined', ended_at = NOW()
				WHERE id = $1 AND status = 'ringing'
			`, callID)
		}
	}
	return nil
}

// EndCall — kết thúc cuộc gọi
func (r *CallRepository) EndCall(ctx context.Context, callID uuid.UUID) error {
	// Set all participants as left
	_, _ = r.pool.Exec(ctx, `
		UPDATE call_participants SET status = 'left', left_at = NOW()
		WHERE call_id = $1 AND status = 'joined'
	`, callID)

	// End the call
	_, err := r.pool.Exec(ctx, `
		UPDATE calls SET 
			status = 'ended', 
			ended_at = NOW(),
			duration_secs = EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at)))::int
		WHERE id = $1 AND status IN ('ringing', 'ongoing')
	`, callID)
	return err
}

// LeaveCall — rời cuộc gọi (group)
func (r *CallRepository) LeaveCall(ctx context.Context, callID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE call_participants SET status = 'left', left_at = NOW()
		WHERE call_id = $1 AND user_id = $2 AND status = 'joined'
	`, callID, userID)
	if err != nil {
		return err
	}

	// Kiểm tra nếu không còn ai trong cuộc gọi
	var count int
	r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM call_participants 
		WHERE call_id = $1 AND status = 'joined'
	`, callID).Scan(&count)

	if count == 0 {
		return r.EndCall(ctx, callID)
	}
	return nil
}

// GetActiveCall — lấy cuộc gọi đang diễn ra trong room
func (r *CallRepository) GetActiveCall(ctx context.Context, roomID uuid.UUID) (*Call, error) {
	var c Call
	err := r.pool.QueryRow(ctx, `
		SELECT c.id, c.room_id, c.caller_id, u.full_name, c.call_type, c.status,
		       c.started_at, c.ended_at, c.duration_secs, c.is_group_call, c.created_at
		FROM calls c
		JOIN users u ON u.id = c.caller_id
		WHERE c.room_id = $1 AND c.status IN ('ringing', 'ongoing')
		ORDER BY c.created_at DESC
		LIMIT 1
	`, roomID).Scan(
		&c.ID, &c.RoomID, &c.CallerID, &c.CallerName, &c.CallType, &c.Status,
		&c.StartedAt, &c.EndedAt, &c.DurationSec, &c.IsGroupCall, &c.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// GetCallParticipants — danh sách participants
func (r *CallRepository) GetCallParticipants(ctx context.Context, callID uuid.UUID) ([]CallParticipant, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT cp.id, cp.call_id, cp.user_id, u.full_name, cp.status, cp.joined_at, cp.left_at
		FROM call_participants cp
		JOIN users u ON u.id = cp.user_id
		WHERE cp.call_id = $1
		ORDER BY cp.joined_at ASC NULLS LAST
	`, callID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var participants []CallParticipant
	for rows.Next() {
		var p CallParticipant
		if err := rows.Scan(&p.ID, &p.CallID, &p.UserID, &p.UserName, &p.Status, &p.JoinedAt, &p.LeftAt); err != nil {
			continue
		}
		participants = append(participants, p)
	}
	return participants, nil
}

// GetCallHistory — lịch sử cuộc gọi
func (r *CallRepository) GetCallHistory(ctx context.Context, userID uuid.UUID, limit int) ([]Call, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.room_id, c.caller_id, u.full_name, c.call_type, c.status,
		       c.started_at, c.ended_at, c.duration_secs, c.is_group_call, c.created_at
		FROM calls c
		JOIN users u ON u.id = c.caller_id
		JOIN call_participants cp ON cp.call_id = c.id
		WHERE cp.user_id = $1
		ORDER BY c.created_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var calls []Call
	for rows.Next() {
		var c Call
		if err := rows.Scan(
			&c.ID, &c.RoomID, &c.CallerID, &c.CallerName, &c.CallType, &c.Status,
			&c.StartedAt, &c.EndedAt, &c.DurationSec, &c.IsGroupCall, &c.CreatedAt,
		); err != nil {
			continue
		}
		calls = append(calls, c)
	}
	return calls, nil
}

// GetByID — lấy call by ID
func (r *CallRepository) GetByID(ctx context.Context, callID uuid.UUID) (*Call, error) {
	var c Call
	err := r.pool.QueryRow(ctx, `
		SELECT c.id, c.room_id, c.caller_id, u.full_name, c.call_type, c.status,
		       c.started_at, c.ended_at, c.duration_secs, c.is_group_call, c.created_at
		FROM calls c
		JOIN users u ON u.id = c.caller_id
		WHERE c.id = $1
	`, callID).Scan(
		&c.ID, &c.RoomID, &c.CallerID, &c.CallerName, &c.CallType, &c.Status,
		&c.StartedAt, &c.EndedAt, &c.DurationSec, &c.IsGroupCall, &c.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}
