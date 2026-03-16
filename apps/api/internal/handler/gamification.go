package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Gamification Handler
// ============================================

type GamificationHandler struct {
	gamRepo *repository.GamificationRepository
}

func NewGamificationHandler(gamRepo *repository.GamificationRepository) *GamificationHandler {
	return &GamificationHandler{gamRepo: gamRepo}
}

// ListAchievements — tất cả achievements
func (h *GamificationHandler) ListAchievements(c *gin.Context) {
	var userID *uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		id := uid.(uuid.UUID)
		userID = &id
	}

	achievements, err := h.gamRepo.ListAchievements(c.Request.Context(), userID)
	if err != nil {
		response.InternalError(c, "Không thể tải thành tựu")
		return
	}
	if achievements == nil {
		achievements = []repository.Achievement{}
	}

	// Count earned
	earned := 0
	for _, a := range achievements {
		if a.Earned {
			earned++
		}
	}

	response.OK(c, gin.H{
		"achievements": achievements,
		"total":        len(achievements),
		"earned":       earned,
	})
}

// MyAchievements — thành tựu đã đạt
func (h *GamificationHandler) MyAchievements(c *gin.Context) {
	userID, _ := c.Get("user_id")
	achievements, err := h.gamRepo.GetUserAchievements(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể tải thành tựu")
		return
	}
	if achievements == nil {
		achievements = []repository.Achievement{}
	}
	response.OK(c, gin.H{
		"achievements": achievements,
		"total":        len(achievements),
	})
}

// CheckIn — check-in tại địa điểm
func (h *GamificationHandler) CheckIn(c *gin.Context) {
	var req struct {
		PlaceName string  `json:"place_name" binding:"required"`
		Lat       float64 `json:"lat" binding:"required"`
		Lng       float64 `json:"lng" binding:"required"`
		PhotoURL  *string `json:"photo_url"`
		Note      *string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu thông tin check-in")
		return
	}

	userID, _ := c.Get("user_id")
	ci := &repository.CheckIn{
		UserID:    userID.(uuid.UUID),
		PlaceName: req.PlaceName,
		Lat:       req.Lat,
		Lng:       req.Lng,
		PhotoURL:  req.PhotoURL,
		Note:      req.Note,
	}

	if err := h.gamRepo.CheckIn(c.Request.Context(), ci); err != nil {
		response.InternalError(c, "Không thể check-in")
		return
	}

	response.Created(c, gin.H{
		"checkin":   ci,
		"xp_earned": ci.XPEarned,
		"message":   "📍 Check-in thành công! +" + strconv.Itoa(ci.XPEarned) + " XP",
	})
}

// GetCheckins — lịch sử check-in
func (h *GamificationHandler) GetCheckins(c *gin.Context) {
	userID, _ := c.Get("user_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	checkins, err := h.gamRepo.GetCheckins(c.Request.Context(), userID.(uuid.UUID), limit)
	if err != nil {
		response.InternalError(c, "Không thể tải check-in")
		return
	}
	if checkins == nil {
		checkins = []repository.CheckIn{}
	}
	response.OK(c, gin.H{
		"checkins": checkins,
		"total":    len(checkins),
	})
}

// GetLeaderboard — bảng xếp hạng
func (h *GamificationHandler) GetLeaderboard(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	entries, err := h.gamRepo.GetLeaderboard(c.Request.Context(), limit)
	if err != nil {
		response.InternalError(c, "Không thể tải bảng xếp hạng")
		return
	}
	if entries == nil {
		entries = []repository.LeaderboardEntry{}
	}
	response.OK(c, gin.H{
		"leaderboard": entries,
		"total":       len(entries),
	})
}

// GetMyStats — thống kê gamification cá nhân
func (h *GamificationHandler) GetMyStats(c *gin.Context) {
	userID, _ := c.Get("user_id")
	stats, err := h.gamRepo.GetUserStats(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể tải thống kê")
		return
	}
	response.OK(c, gin.H{"stats": stats})
}
