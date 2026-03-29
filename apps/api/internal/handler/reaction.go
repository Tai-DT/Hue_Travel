package handler

import (
	"encoding/json"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/huetravel/api/internal/repository"
	ws "github.com/huetravel/api/internal/websocket"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Reaction Handler — Emoji reactions trên tin nhắn
// ============================================

type ReactionHandler struct {
	reactionRepo *repository.ReactionRepository
	hub          *ws.Hub
}

func NewReactionHandler(reactionRepo *repository.ReactionRepository) *ReactionHandler {
	return &ReactionHandler{reactionRepo: reactionRepo}
}

func (h *ReactionHandler) SetHub(hub *ws.Hub) {
	h.hub = hub
}

// ToggleReaction — thả/gỡ reaction emoji trên tin nhắn
// Supported emojis: ❤️ 😂 👍 😮 😢 🔥 🎉 💯 🥰 😡
func (h *ReactionHandler) ToggleReaction(c *gin.Context) {
	messageID, err := uuid.Parse(c.Param("message_id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Message ID không hợp lệ")
		return
	}

	var req struct {
		Emoji string `json:"emoji" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu emoji")
		return
	}

	// Validate emoji
	validEmojis := map[string]bool{
		"❤️": true, "😂": true, "👍": true, "😮": true, "😢": true,
		"🔥": true, "🎉": true, "💯": true, "🥰": true, "😡": true,
		"👎": true, "😍": true, "🤔": true, "😱": true, "🙏": true,
	}
	if !validEmojis[req.Emoji] {
		response.BadRequest(c, "HT-VAL-001", "Emoji không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	added, err := h.reactionRepo.ToggleReaction(c.Request.Context(), messageID, userID.(uuid.UUID), req.Emoji)
	if err != nil {
		response.InternalError(c, "Không thể thao tác reaction")
		return
	}

	action := "removed"
	if added {
		action = "added"
	}

	// Broadcast reaction via WebSocket
	if h.hub != nil {
		roomID := c.Query("room_id")
		wsPayload := ws.WSMessage{
			Type:     "reaction",
			RoomID:   roomID,
			SenderID: userID.(uuid.UUID).String(),
			Content:  req.Emoji,
		}
		reactionData, _ := json.Marshal(gin.H{
			"message_id": messageID,
			"emoji":      req.Emoji,
			"action":     action,
			"user_id":    userID,
		})
		wsPayload.Data = reactionData
		data, _ := json.Marshal(wsPayload)
		if roomID != "" {
			h.hub.BroadcastToRoom(roomID, data)
		}
	}

	response.OK(c, gin.H{
		"action": action,
		"emoji":  req.Emoji,
	})
}

// GetReactions — danh sách reactions cho tin nhắn
func (h *ReactionHandler) GetReactions(c *gin.Context) {
	messageID, err := uuid.Parse(c.Param("message_id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Message ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	summary, err := h.reactionRepo.GetReactionSummary(c.Request.Context(), messageID, userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể tải reactions")
		return
	}

	if summary == nil {
		summary = []repository.ReactionSummary{}
	}

	response.OK(c, gin.H{
		"reactions": summary,
	})
}
