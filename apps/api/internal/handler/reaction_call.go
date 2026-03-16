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

// ============================================
// Call Handler — Voice & Video Calls
// ============================================

type CallHandler struct {
	callRepo *repository.CallRepository
	chatRepo *repository.ChatRepository
	hub      *ws.Hub
}

func NewCallHandler(callRepo *repository.CallRepository, chatRepo *repository.ChatRepository) *CallHandler {
	return &CallHandler{callRepo: callRepo, chatRepo: chatRepo}
}

func (h *CallHandler) SetHub(hub *ws.Hub) {
	h.hub = hub
}

// InitiateCall — bắt đầu cuộc gọi voice/video
func (h *CallHandler) InitiateCall(c *gin.Context) {
	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Room ID không hợp lệ")
		return
	}

	var req struct {
		CallType    string `json:"call_type"` // voice, video
		IsGroupCall bool   `json:"is_group_call"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.CallType = "voice"
	}
	if req.CallType == "" {
		req.CallType = "voice"
	}
	if req.CallType != "voice" && req.CallType != "video" {
		response.BadRequest(c, "HT-VAL-001", "Call type phải là 'voice' hoặc 'video'")
		return
	}

	userID, _ := c.Get("user_id")

	// Check if there's already an active call
	existing, _ := h.callRepo.GetActiveCall(c.Request.Context(), roomID)
	if existing != nil {
		response.BadRequest(c, "HT-CALL-001", "Phòng đang có cuộc gọi")
		return
	}

	call, err := h.callRepo.InitiateCall(c.Request.Context(), roomID, userID.(uuid.UUID), req.CallType, req.IsGroupCall)
	if err != nil {
		response.InternalError(c, "Không thể bắt đầu cuộc gọi")
		return
	}

	// Invite all room participants
	if h.chatRepo != nil {
		rooms, _ := h.chatRepo.ListRooms(c.Request.Context(), userID.(uuid.UUID))
		for _, room := range rooms {
			if room.ID == roomID {
				var otherUsers []uuid.UUID
				for _, pid := range room.Participants {
					if pid != userID.(uuid.UUID) {
						otherUsers = append(otherUsers, pid)
					}
				}
				if len(otherUsers) > 0 {
					_ = h.callRepo.AddParticipants(c.Request.Context(), call.ID, otherUsers)
				}
				break
			}
		}
	}

	// Broadcast call via WebSocket
	if h.hub != nil {
		callJSON, _ := json.Marshal(call)
		wsPayload := ws.WSMessage{
			Type:     "call_incoming",
			RoomID:   roomID.String(),
			SenderID: userID.(uuid.UUID).String(),
			Content:  req.CallType,
			Data:     callJSON,
		}
		data, _ := json.Marshal(wsPayload)
		h.hub.BroadcastToRoom(roomID.String(), data)
	}

	response.Created(c, gin.H{"call": call})
}

// AnswerCall — trả lời cuộc gọi
func (h *CallHandler) AnswerCall(c *gin.Context) {
	callID, err := uuid.Parse(c.Param("call_id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Call ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	err = h.callRepo.AnswerCall(c.Request.Context(), callID, userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể trả lời cuộc gọi")
		return
	}

	call, _ := h.callRepo.GetByID(c.Request.Context(), callID)

	// Broadcast
	if h.hub != nil && call != nil {
		callJSON, _ := json.Marshal(call)
		wsPayload := ws.WSMessage{
			Type:     "call_accepted",
			RoomID:   call.RoomID.String(),
			SenderID: userID.(uuid.UUID).String(),
			Data:     callJSON,
		}
		data, _ := json.Marshal(wsPayload)
		h.hub.BroadcastToRoom(call.RoomID.String(), data)
	}

	response.OK(c, gin.H{"message": "Đã chấp nhận cuộc gọi", "call": call})
}

// DeclineCall — từ chối cuộc gọi
func (h *CallHandler) DeclineCall(c *gin.Context) {
	callID, err := uuid.Parse(c.Param("call_id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Call ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	err = h.callRepo.DeclineCall(c.Request.Context(), callID, userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể từ chối cuộc gọi")
		return
	}

	call, _ := h.callRepo.GetByID(c.Request.Context(), callID)

	if h.hub != nil && call != nil {
		callJSON, _ := json.Marshal(call)
		wsPayload := ws.WSMessage{
			Type:     "call_declined",
			RoomID:   call.RoomID.String(),
			SenderID: userID.(uuid.UUID).String(),
			Data:     callJSON,
		}
		data, _ := json.Marshal(wsPayload)
		h.hub.BroadcastToRoom(call.RoomID.String(), data)
	}

	response.OK(c, gin.H{"message": "Đã từ chối cuộc gọi"})
}

// EndCall — kết thúc cuộc gọi
func (h *CallHandler) EndCall(c *gin.Context) {
	callID, err := uuid.Parse(c.Param("call_id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Call ID không hợp lệ")
		return
	}

	call, _ := h.callRepo.GetByID(c.Request.Context(), callID)

	err = h.callRepo.EndCall(c.Request.Context(), callID)
	if err != nil {
		response.InternalError(c, "Không thể kết thúc cuộc gọi")
		return
	}

	if h.hub != nil && call != nil {
		userID, _ := c.Get("user_id")
		callJSON, _ := json.Marshal(call)
		wsPayload := ws.WSMessage{
			Type:     "call_ended",
			RoomID:   call.RoomID.String(),
			SenderID: userID.(uuid.UUID).String(),
			Data:     callJSON,
		}
		data, _ := json.Marshal(wsPayload)
		h.hub.BroadcastToRoom(call.RoomID.String(), data)
	}

	response.OK(c, gin.H{"message": "Cuộc gọi đã kết thúc"})
}

// LeaveCall — rời cuộc gọi nhóm
func (h *CallHandler) LeaveCall(c *gin.Context) {
	callID, err := uuid.Parse(c.Param("call_id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Call ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	err = h.callRepo.LeaveCall(c.Request.Context(), callID, userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể rời cuộc gọi")
		return
	}

	response.OK(c, gin.H{"message": "Đã rời cuộc gọi"})
}

// GetActiveCall — cuộc gọi đang diễn ra trong room
func (h *CallHandler) GetActiveCall(c *gin.Context) {
	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Room ID không hợp lệ")
		return
	}

	call, err := h.callRepo.GetActiveCall(c.Request.Context(), roomID)
	if err != nil {
		response.OK(c, gin.H{"active_call": nil})
		return
	}

	participants, _ := h.callRepo.GetCallParticipants(c.Request.Context(), call.ID)
	if participants == nil {
		participants = []repository.CallParticipant{}
	}

	response.OK(c, gin.H{
		"active_call":  call,
		"participants": participants,
	})
}

// GetCallHistory — lịch sử cuộc gọi
func (h *CallHandler) GetCallHistory(c *gin.Context) {
	userID, _ := c.Get("user_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	calls, err := h.callRepo.GetCallHistory(c.Request.Context(), userID.(uuid.UUID), limit)
	if err != nil {
		response.InternalError(c, "Không thể tải lịch sử cuộc gọi")
		return
	}
	if calls == nil {
		calls = []repository.Call{}
	}

	response.OK(c, gin.H{
		"calls": calls,
		"total": len(calls),
	})
}

// GetCallParticipants — danh sách participants
func (h *CallHandler) GetCallParticipants(c *gin.Context) {
	callID, err := uuid.Parse(c.Param("call_id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Call ID không hợp lệ")
		return
	}

	participants, err := h.callRepo.GetCallParticipants(c.Request.Context(), callID)
	if err != nil {
		response.InternalError(c, "Không thể tải participants")
		return
	}
	if participants == nil {
		participants = []repository.CallParticipant{}
	}

	response.OK(c, gin.H{
		"participants": participants,
		"total":        len(participants),
	})
}
