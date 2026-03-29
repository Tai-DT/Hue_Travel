package handler

import (
	"encoding/json"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/huetravel/api/internal/repository"
	ws "github.com/huetravel/api/internal/websocket"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Chat Handler (REST + WebSocket broadcast)
// ============================================

type ChatHandler struct {
	chatRepo *repository.ChatRepository
	hub      *ws.Hub
}

func NewChatHandler(chatRepo *repository.ChatRepository) *ChatHandler {
	return &ChatHandler{chatRepo: chatRepo}
}

// SetHub assigns the WebSocket hub for real-time message broadcasting.
func (h *ChatHandler) SetHub(hub *ws.Hub) {
	h.hub = hub
}

func (h *ChatHandler) requireRoomParticipant(c *gin.Context, roomID uuid.UUID) (uuid.UUID, bool) {
	userValue, _ := c.Get("user_id")
	userID := userValue.(uuid.UUID)

	hasAccess, err := h.chatRepo.UserHasAccessToRoom(c.Request.Context(), roomID, userID)
	if err != nil {
		response.InternalError(c, "Không thể kiểm tra quyền truy cập phòng chat")
		return uuid.Nil, false
	}

	if !hasAccess {
		response.Forbidden(c, "Bạn không có quyền truy cập phòng chat này")
		return uuid.Nil, false
	}

	return userID, true
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
		RecipientID string `json:"recipient_id"`
		OtherUserID string `json:"other_user_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu recipient_id")
		return
	}

	recipientIDStr := req.RecipientID
	if recipientIDStr == "" {
		recipientIDStr = req.OtherUserID
	}
	if recipientIDStr == "" {
		response.BadRequest(c, "HT-VAL-001", "Thiếu recipient_id")
		return
	}

	userID, _ := c.Get("user_id")
	recipientID, err := uuid.Parse(recipientIDStr)
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Recipient ID không hợp lệ")
		return
	}

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

	userID, ok := h.requireRoomParticipant(c, roomID)
	if !ok {
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
	_ = h.chatRepo.MarkAsRead(c.Request.Context(), roomID, userID)

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

	userID, ok := h.requireRoomParticipant(c, roomID)
	if !ok {
		return
	}

	var req struct {
		Content     string  `json:"content" binding:"required"`
		MessageType string  `json:"message_type"` // text, image, location
		Type        string  `json:"type"`
		Metadata    *string `json:"metadata,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Nội dung tin nhắn không hợp lệ")
		return
	}

	if req.MessageType == "" {
		req.MessageType = req.Type
	}
	if req.MessageType == "" {
		req.MessageType = "text"
	}

	msg, err := h.chatRepo.SendMessage(
		c.Request.Context(),
		roomID,
		userID,
		req.Content,
		req.MessageType,
		req.Metadata,
	)
	if err != nil {
		response.InternalError(c, "Không thể gửi tin nhắn")
		return
	}

	// Broadcast via WebSocket for real-time delivery
	if h.hub != nil {
		wsPayload := ws.WSMessage{
			Type:     "message",
			RoomID:   roomID.String(),
			SenderID: userID.String(),
			Content:  req.Content,
		}
		if msgJSON, err := json.Marshal(msg); err == nil {
			wsPayload.Data = msgJSON
		}
		participants, err := h.chatRepo.GetRoomParticipantIDs(c.Request.Context(), roomID)
		if err == nil {
			for _, participantID := range participants {
				h.hub.SendToUser(participantID, wsPayload)
			}
		} else {
			data, _ := json.Marshal(wsPayload)
			h.hub.BroadcastToRoom(roomID.String(), data)
		}
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

	userID, ok := h.requireRoomParticipant(c, roomID)
	if !ok {
		return
	}

	if err := h.chatRepo.MarkAsRead(c.Request.Context(), roomID, userID); err != nil {
		response.InternalError(c, "Không thể đánh dấu đã đọc")
		return
	}

	response.OK(c, gin.H{"message": "Đã đánh dấu đã đọc"})
}
