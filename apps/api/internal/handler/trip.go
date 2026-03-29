package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Trip Handler — Chuyến đi chung + Mời guide
// ============================================

type TripHandler struct {
	tripRepo   *repository.TripRepository
	chatRepo   *repository.ChatRepository
	guideRepo  *repository.GuideProfileRepository
	friendRepo *repository.FriendRepository
}

func parseTripDate(value *string) (*time.Time, error) {
	if value == nil {
		return nil, nil
	}

	raw := strings.TrimSpace(*value)
	if raw == "" {
		return nil, nil
	}

	for _, layout := range []string{"2006-01-02", time.RFC3339, time.RFC3339Nano} {
		if parsed, err := time.Parse(layout, raw); err == nil {
			return &parsed, nil
		}
	}

	return nil, fmt.Errorf("invalid date format")
}

func NewTripHandler(
	tripRepo *repository.TripRepository,
	chatRepo *repository.ChatRepository,
	guideRepo *repository.GuideProfileRepository,
	friendRepo *repository.FriendRepository,
) *TripHandler {
	return &TripHandler{
		tripRepo:   tripRepo,
		chatRepo:   chatRepo,
		guideRepo:  guideRepo,
		friendRepo: friendRepo,
	}
}

func (h *TripHandler) requireAcceptedTripMember(c *gin.Context, tripID uuid.UUID) (uuid.UUID, bool) {
	userValue, _ := c.Get("user_id")
	userID := userValue.(uuid.UUID)

	if !h.tripRepo.IsMember(c.Request.Context(), tripID, userID) {
		response.Forbidden(c, "Bạn cần tham gia chuyến đi trước khi quản lý thành viên")
		return uuid.Nil, false
	}

	return userID, true
}

// Create — tạo chuyến đi
func (h *TripHandler) Create(c *gin.Context) {
	var req struct {
		Title       string           `json:"title" binding:"required"`
		Description *string          `json:"description"`
		Destination string           `json:"destination"`
		StartDate   *string          `json:"start_date"`
		EndDate     *string          `json:"end_date"`
		MaxMembers  int              `json:"max_members"`
		IsPublic    bool             `json:"is_public"`
		PlanData    *json.RawMessage `json:"plan_data"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu tiêu đề chuyến đi")
		return
	}

	userID, _ := c.Get("user_id")
	startDate, err := parseTripDate(req.StartDate)
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "start_date không hợp lệ")
		return
	}
	endDate, err := parseTripDate(req.EndDate)
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "end_date không hợp lệ")
		return
	}

	trip := &repository.Trip{
		CreatorID:   userID.(uuid.UUID),
		Title:       req.Title,
		Description: req.Description,
		Destination: req.Destination,
		StartDate:   startDate,
		EndDate:     endDate,
		MaxMembers:  req.MaxMembers,
		IsPublic:    req.IsPublic,
		PlanData:    []byte("{}"),
	}

	if trip.Destination == "" {
		trip.Destination = "Huế"
	}
	if trip.MaxMembers <= 0 {
		trip.MaxMembers = 10
	}
	if req.PlanData != nil {
		trip.PlanData = *req.PlanData
	}

	created, err := h.tripRepo.Create(c.Request.Context(), trip)
	if err != nil {
		response.InternalError(c, "Không thể tạo chuyến đi: "+err.Error())
		return
	}

	// Auto-create group chat room for the trip
	if h.chatRepo != nil {
		room, err := h.chatRepo.CreateGroupRoom(
			c.Request.Context(),
			userID.(uuid.UUID),
			"🗺️ "+req.Title,
		)
		if err == nil && room != nil {
			_ = h.tripRepo.SetChatRoom(c.Request.Context(), created.ID, room.ID)
			created.ChatRoomID = &room.ID
		}
	}

	response.Created(c, gin.H{"trip": created})
}

// GetByID — chi tiết chuyến đi
func (h *TripHandler) GetByID(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Trip ID không hợp lệ")
		return
	}

	trip, err := h.tripRepo.GetByID(c.Request.Context(), tripID)
	if err != nil {
		response.NotFound(c, "Không tìm thấy chuyến đi")
		return
	}

	members, _ := h.tripRepo.ListMembers(c.Request.Context(), tripID)
	if members == nil {
		members = []repository.TripMember{}
	}

	response.OK(c, gin.H{
		"trip":    trip,
		"members": members,
	})
}

// ListMyTrips — chuyến đi của tôi
func (h *TripHandler) ListMyTrips(c *gin.Context) {
	userID, _ := c.Get("user_id")

	trips, err := h.tripRepo.ListByUser(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể tải chuyến đi")
		return
	}
	if trips == nil {
		trips = []repository.Trip{}
	}

	response.OK(c, gin.H{
		"trips": trips,
		"total": len(trips),
	})
}

// Discover — tìm chuyến đi công khai
func (h *TripHandler) Discover(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	trips, err := h.tripRepo.ListPublic(c.Request.Context(), limit, offset)
	if err != nil {
		response.InternalError(c, "Không thể tải chuyến đi")
		return
	}
	if trips == nil {
		trips = []repository.Trip{}
	}

	response.OK(c, gin.H{
		"trips": trips,
		"total": len(trips),
	})
}

// InviteMember — mời thành viên (bạn bè hoặc guide)
func (h *TripHandler) InviteMember(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Trip ID không hợp lệ")
		return
	}

	var req struct {
		UserID string `json:"user_id" binding:"required"`
		Role   string `json:"role"` // member or guide
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu user_id")
		return
	}

	inviteeID, err := uuid.Parse(req.UserID)
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "User ID không hợp lệ")
		return
	}

	inviterID, ok := h.requireAcceptedTripMember(c, tripID)
	if !ok {
		return
	}

	role := req.Role
	if role == "" {
		role = "member"
	}

	if role == "member" && h.friendRepo != nil && !h.friendRepo.AreFriends(c.Request.Context(), inviterID, inviteeID) {
		response.Forbidden(c, "Chỉ có thể mời bạn bè vào chuyến đi")
		return
	}

	err = h.tripRepo.InviteMember(c.Request.Context(), tripID, inviteeID, inviterID, role)
	if err != nil {
		response.InternalError(c, "Không thể mời thành viên")
		return
	}

	response.OK(c, gin.H{"message": "Đã mời tham gia chuyến đi"})
}

// AcceptInvite — chấp nhận lời mời
func (h *TripHandler) AcceptInvite(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Trip ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	err = h.tripRepo.AcceptInvite(c.Request.Context(), tripID, userID.(uuid.UUID))
	if err != nil {
		if errors.Is(err, repository.ErrTripInviteNotFound) {
			response.Forbidden(c, "Bạn không có lời mời tham gia chuyến đi này")
			return
		}
		response.InternalError(c, "Không thể chấp nhận lời mời")
		return
	}

	trip, _ := h.tripRepo.GetByID(c.Request.Context(), tripID)
	if trip != nil && trip.ChatRoomID != nil && h.chatRepo != nil {
		_ = h.chatRepo.AddParticipant(c.Request.Context(), *trip.ChatRoomID, userID.(uuid.UUID))
	}

	response.OK(c, gin.H{"message": "Đã tham gia chuyến đi"})
}

// DeclineInvite — từ chối lời mời
func (h *TripHandler) DeclineInvite(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Trip ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	err = h.tripRepo.DeclineInvite(c.Request.Context(), tripID, userID.(uuid.UUID))
	if err != nil {
		if errors.Is(err, repository.ErrTripInviteNotFound) {
			response.Forbidden(c, "Bạn không có lời mời để từ chối")
			return
		}
		response.InternalError(c, "Không thể từ chối")
		return
	}

	response.OK(c, gin.H{"message": "Đã từ chối lời mời"})
}

// JoinPublic — tham gia chuyến đi công khai
func (h *TripHandler) JoinPublic(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Trip ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	err = h.tripRepo.JoinPublicTrip(c.Request.Context(), tripID, userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể tham gia")
		return
	}

	// Add to group chat
	trip, _ := h.tripRepo.GetByID(c.Request.Context(), tripID)
	if trip != nil && trip.ChatRoomID != nil && h.chatRepo != nil {
		_ = h.chatRepo.AddParticipant(c.Request.Context(), *trip.ChatRoomID, userID.(uuid.UUID))
	}

	response.OK(c, gin.H{"message": "Đã tham gia chuyến đi"})
}

// Leave — rời chuyến đi
func (h *TripHandler) Leave(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Trip ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	err = h.tripRepo.LeaveTrip(c.Request.Context(), tripID, userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể rời chuyến đi")
		return
	}

	trip, _ := h.tripRepo.GetByID(c.Request.Context(), tripID)
	if trip != nil && trip.ChatRoomID != nil && h.chatRepo != nil {
		_ = h.chatRepo.RemoveParticipant(c.Request.Context(), *trip.ChatRoomID, userID.(uuid.UUID))
	}

	response.OK(c, gin.H{"message": "Đã rời chuyến đi"})
}

// ListInvitations — danh sách lời mời chuyến đi
func (h *TripHandler) ListInvitations(c *gin.Context) {
	userID, _ := c.Get("user_id")

	trips, err := h.tripRepo.ListUserInvitations(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể tải lời mời")
		return
	}
	if trips == nil {
		trips = []repository.Trip{}
	}

	response.OK(c, gin.H{
		"invitations": trips,
		"total":       len(trips),
	})
}

// InviteGuide — mời guide tham gia trip (tìm & mời)
func (h *TripHandler) InviteGuide(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Trip ID không hợp lệ")
		return
	}

	var req struct {
		GuideID string `json:"guide_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu guide_id")
		return
	}

	guideID, err := uuid.Parse(req.GuideID)
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Guide ID không hợp lệ")
		return
	}

	inviterID, ok := h.requireAcceptedTripMember(c, tripID)
	if !ok {
		return
	}

	if h.guideRepo != nil {
		guideProfile, err := h.guideRepo.GetByUserID(c.Request.Context(), guideID)
		if err != nil {
			response.InternalError(c, "Không thể kiểm tra hướng dẫn viên")
			return
		}
		if guideProfile == nil || !guideProfile.IsApproved {
			response.BadRequest(c, "HT-VAL-001", "Hướng dẫn viên không hợp lệ")
			return
		}
	}

	err = h.tripRepo.InviteMember(c.Request.Context(), tripID, guideID, inviterID, "guide")
	if err != nil {
		response.InternalError(c, "Không thể mời hướng dẫn viên")
		return
	}

	response.OK(c, gin.H{"message": "Đã mời hướng dẫn viên tham gia"})
}

// SearchGuides — tìm hướng dẫn viên cho trip
func (h *TripHandler) SearchGuides(c *gin.Context) {
	if h.guideRepo == nil {
		response.ServiceUnavailable(c, "HT-GUIDE-001", "Dịch vụ guide chưa sẵn sàng")
		return
	}

	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Trip ID không hợp lệ")
		return
	}
	if _, ok := h.requireAcceptedTripMember(c, tripID); !ok {
		return
	}

	specialty := c.Query("specialty")

	guides, err := h.guideRepo.SearchAvailableGuides(c.Request.Context(), specialty)
	if err != nil {
		response.InternalError(c, "Không thể tìm hướng dẫn viên")
		return
	}

	response.OK(c, gin.H{
		"guides": guides,
		"total":  len(guides),
	})
}
