package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/huetravel/api/internal/service"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Notification Handler
// Reads from DB when available, falls back to mock
// ============================================

type NotificationHandler struct {
	notifService *service.NotificationService
	pool         *pgxpool.Pool
}

func NewNotificationHandler(notifService *service.NotificationService, pool *pgxpool.Pool) *NotificationHandler {
	return &NotificationHandler{notifService: notifService, pool: pool}
}

// GetNotifications — lấy danh sách thông báo từ DB
func (h *NotificationHandler) GetNotifications(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "Chưa xác thực")
		return
	}
	uid := userID.(uuid.UUID)

	if h.pool != nil {
		// Real DB query
		ctx := c.Request.Context()
		rows, err := h.pool.Query(ctx, `
			SELECT id, user_id, type, title, body, is_read, created_at
			FROM notifications 
			WHERE user_id = $1 
			ORDER BY created_at DESC 
			LIMIT 50`, uid)
		if err == nil {
			var notifications []service.Notification
			for rows.Next() {
				var n service.Notification
				rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body, &n.IsRead, &n.CreatedAt)
				notifications = append(notifications, n)
			}
			rows.Close()

			unread := 0
			for _, n := range notifications {
				if !n.IsRead {
					unread++
				}
			}

			response.OK(c, gin.H{
				"notifications": notifications,
				"unread_count":  unread,
				"total":         len(notifications),
			})
			return
		}
	}

	// Fallback to mock
	notifications := h.notifService.GetMockNotifications(uid)
	unread := 0
	for _, n := range notifications {
		if !n.IsRead {
			unread++
		}
	}

	response.OK(c, gin.H{
		"notifications": notifications,
		"unread_count":  unread,
		"total":         len(notifications),
	})
}

// MarkRead — đánh dấu đã đọc
func (h *NotificationHandler) MarkRead(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "Chưa xác thực")
		return
	}
	uid := userID.(uuid.UUID)
	notifID := c.Param("id")

	if h.pool != nil {
		ctx := c.Request.Context()
		if notifID == "all" {
			result, err := h.pool.Exec(ctx,
				`UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`, uid)
			if err != nil {
				response.InternalError(c, "Không thể cập nhật")
				return
			}
			response.OK(c, gin.H{
				"message": "Đã đánh dấu tất cả đã đọc",
				"count":   result.RowsAffected(),
			})
			return
		}

		nid, err := uuid.Parse(notifID)
		if err != nil {
			response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
			return
		}

		_, err = h.pool.Exec(ctx,
			`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`, nid, uid)
		if err != nil {
			response.InternalError(c, "Không thể cập nhật")
			return
		}

		response.OK(c, gin.H{
			"message": "Đã đánh dấu đã đọc",
			"id":      notifID,
		})
		return
	}

	// Mock
	if notifID == "all" {
		response.OK(c, gin.H{"message": "Đã đánh dấu tất cả đã đọc", "count": 0})
		return
	}
	_, err := uuid.Parse(notifID)
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}
	response.OK(c, gin.H{"message": "Đã đánh dấu đã đọc", "id": notifID})
}

// RegisterDevice — đăng ký FCM token
func (h *NotificationHandler) RegisterDevice(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "Chưa xác thực")
		return
	}
	uid := userID.(uuid.UUID)

	var req struct {
		FCMToken string `json:"fcm_token" binding:"required"`
		Platform string `json:"platform" binding:"required"` // ios, android
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Token không hợp lệ")
		return
	}

	if h.pool != nil {
		ctx := c.Request.Context()
		_, err := h.pool.Exec(ctx, `
			INSERT INTO device_tokens (id, user_id, fcm_token, platform, created_at, updated_at) 
			VALUES ($1, $2, $3, $4, NOW(), NOW())
			ON CONFLICT (user_id, fcm_token) DO UPDATE SET updated_at = NOW()`,
			uuid.New(), uid, req.FCMToken, req.Platform)
		if err != nil {
			// Table might not exist yet — fall through to mock response
			_ = err
		}
	}

	response.OK(c, gin.H{
		"message":  "Đã đăng ký thiết bị",
		"platform": req.Platform,
	})
}

// UnreadCount — số thông báo chưa đọc
func (h *NotificationHandler) UnreadCount(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "Chưa xác thực")
		return
	}
	uid := userID.(uuid.UUID)

	if h.pool != nil {
		var count int
		err := h.pool.QueryRow(c.Request.Context(),
			`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`, uid).Scan(&count)
		if err == nil {
			response.OK(c, gin.H{"unread_count": count})
			return
		}
	}

	response.OK(c, gin.H{"unread_count": 0})
}
