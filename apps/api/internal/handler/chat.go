package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Chat Handler (REST — WebSocket sẽ thêm sau)
// ============================================

type ChatHandler struct {
	chatRepo *repository.ChatRepository
}

func NewChatHandler(chatRepo *repository.ChatRepository) *ChatHandler {
	return &ChatHandler{chatRepo: chatRepo}
}

// ListRooms — danh sách phòng chat của user
func (h *ChatHandler) ListRooms(c *gin.Context) {
	userID, _ := c.Get("user_id")

	rooms, err := h.chatRepo.ListRooms(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể tải danh sách chat")
		return
	}

	response.OK(c, gin.H{
		"rooms": rooms,
		"total": len(rooms),
	})
}

// GetOrCreateRoom — tạo/lấy phòng chat direct
func (h *ChatHandler) GetOrCreateRoom(c *gin.Context) {
	var req struct {
		RecipientID string `json:"recipient_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu recipient_id")
		return
	}

	userID, _ := c.Get("user_id")
	recipientID, _ := uuid.Parse(req.RecipientID)

	room, err := h.chatRepo.GetOrCreateDirectRoom(
		c.Request.Context(),
		userID.(uuid.UUID),
		recipientID,
	)
	if err != nil {
		response.InternalError(c, "Không thể tạo phòng chat")
		return
	}

	response.OK(c, gin.H{"room": room})
}

// GetMessages — lịch sử tin nhắn
func (h *ChatHandler) GetMessages(c *gin.Context) {
	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Room ID không hợp lệ")
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	messages, err := h.chatRepo.GetMessages(c.Request.Context(), roomID, limit, offset)
	if err != nil {
		response.InternalError(c, "Không thể tải tin nhắn")
		return
	}

	// Mark messages as read
	userID, _ := c.Get("user_id")
	_ = h.chatRepo.MarkAsRead(c.Request.Context(), roomID, userID.(uuid.UUID))

	response.OK(c, gin.H{
		"messages": messages,
		"total":    len(messages),
	})
}

// SendMessage — gửi tin nhắn
func (h *ChatHandler) SendMessage(c *gin.Context) {
	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Room ID không hợp lệ")
		return
	}

	var req struct {
		Content     string  `json:"content" binding:"required"`
		MessageType string  `json:"message_type"` // text, image, location
		Metadata    *string `json:"metadata,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Nội dung tin nhắn không hợp lệ")
		return
	}

	if req.MessageType == "" {
		req.MessageType = "text"
	}

	userID, _ := c.Get("user_id")

	msg, err := h.chatRepo.SendMessage(
		c.Request.Context(),
		roomID,
		userID.(uuid.UUID),
		req.Content,
		req.MessageType,
		req.Metadata,
	)
	if err != nil {
		response.InternalError(c, "Không thể gửi tin nhắn")
		return
	}

	response.Created(c, gin.H{"message": msg})
}

// MarkRead — đánh dấu đã đọc
func (h *ChatHandler) MarkRead(c *gin.Context) {
	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Room ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	if err := h.chatRepo.MarkAsRead(c.Request.Context(), roomID, userID.(uuid.UUID)); err != nil {
		response.InternalError(c, "Không thể đánh dấu đã đọc")
		return
	}

	response.OK(c, gin.H{"message": "Đã đánh dấu đã đọc"})
}
