package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Friend Handler — Kết bạn
// ============================================

type FriendHandler struct {
	friendRepo *repository.FriendRepository
}

func NewFriendHandler(friendRepo *repository.FriendRepository) *FriendHandler {
	return &FriendHandler{friendRepo: friendRepo}
}

// SendRequest — gửi lời kết bạn
func (h *FriendHandler) SendRequest(c *gin.Context) {
	var req struct {
		UserID string `json:"user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu user_id")
		return
	}

	userID, _ := c.Get("user_id")
	addresseeID, err := uuid.Parse(req.UserID)
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "User ID không hợp lệ")
		return
	}

	if userID.(uuid.UUID) == addresseeID {
		response.BadRequest(c, "HT-VAL-001", "Không thể kết bạn với chính mình")
		return
	}

	friendship, err := h.friendRepo.SendRequest(c.Request.Context(), userID.(uuid.UUID), addresseeID)
	if err != nil {
		response.InternalError(c, "Không thể gửi lời kết bạn")
		return
	}

	response.Created(c, gin.H{"friendship": friendship})
}

// AcceptRequest — chấp nhận lời kết bạn
func (h *FriendHandler) AcceptRequest(c *gin.Context) {
	friendshipID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Friendship ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	if err := h.friendRepo.AcceptRequest(c.Request.Context(), friendshipID, userID.(uuid.UUID)); err != nil {
		response.InternalError(c, "Không thể chấp nhận")
		return
	}

	response.OK(c, gin.H{"message": "Đã chấp nhận kết bạn"})
}

// DeclineRequest — từ chối lời kết bạn
func (h *FriendHandler) DeclineRequest(c *gin.Context) {
	friendshipID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Friendship ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	if err := h.friendRepo.DeclineRequest(c.Request.Context(), friendshipID, userID.(uuid.UUID)); err != nil {
		response.InternalError(c, "Không thể từ chối")
		return
	}

	response.OK(c, gin.H{"message": "Đã từ chối lời kết bạn"})
}

// Unfriend — hủy kết bạn
func (h *FriendHandler) Unfriend(c *gin.Context) {
	friendID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "User ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	if err := h.friendRepo.Unfriend(c.Request.Context(), userID.(uuid.UUID), friendID); err != nil {
		response.InternalError(c, "Không thể hủy kết bạn")
		return
	}

	response.OK(c, gin.H{"message": "Đã hủy kết bạn"})
}

// ListFriends — danh sách bạn bè
func (h *FriendHandler) ListFriends(c *gin.Context) {
	userID, _ := c.Get("user_id")

	friends, err := h.friendRepo.ListFriends(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể tải danh sách bạn bè")
		return
	}

	if friends == nil {
		friends = []repository.FriendInfo{}
	}

	response.OK(c, gin.H{
		"friends": friends,
		"total":   len(friends),
	})
}

// ListPendingRequests — lời mời đang chờ
func (h *FriendHandler) ListPendingRequests(c *gin.Context) {
	userID, _ := c.Get("user_id")

	requests, err := h.friendRepo.ListPendingRequests(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể tải lời mời")
		return
	}

	if requests == nil {
		requests = []repository.FriendInfo{}
	}

	response.OK(c, gin.H{
		"requests": requests,
		"total":    len(requests),
	})
}

// CheckStatus — kiểm tra trạng thái kết bạn
func (h *FriendHandler) CheckStatus(c *gin.Context) {
	otherID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "User ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	friendship, err := h.friendRepo.GetFriendshipStatus(c.Request.Context(), userID.(uuid.UUID), otherID)
	if err != nil {
		response.OK(c, gin.H{"status": "none"})
		return
	}

	response.OK(c, gin.H{
		"status":     friendship.Status,
		"friendship": friendship,
	})
}
