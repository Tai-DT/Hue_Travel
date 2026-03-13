package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/huetravel/api/internal/model"
	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Review Handler
// ============================================

type ReviewHandler struct {
	reviewRepo *repository.ReviewRepository
	userRepo   *repository.UserRepository
}

func NewReviewHandler(reviewRepo *repository.ReviewRepository, userRepo *repository.UserRepository) *ReviewHandler {
	return &ReviewHandler{reviewRepo: reviewRepo, userRepo: userRepo}
}

func (h *ReviewHandler) Create(c *gin.Context) {
	var req struct {
		ExperienceID  string   `json:"experience_id" binding:"required"`
		BookingID     string   `json:"booking_id" binding:"required"`
		OverallRating float64  `json:"overall_rating" binding:"required,min=1,max=5"`
		GuideRating   float64  `json:"guide_rating" binding:"required,min=1,max=5"`
		ValueRating   float64  `json:"value_rating" binding:"required,min=1,max=5"`
		Comment       string   `json:"comment" binding:"required,min=10"`
		PhotoURLs     []string `json:"photo_urls"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ: "+err.Error())
		return
	}

	travelerID, _ := c.Get("user_id")
	expID, _ := uuid.Parse(req.ExperienceID)
	bookingID, _ := uuid.Parse(req.BookingID)
	comment := req.Comment

	review := &model.Review{
		TravelerID:    travelerID.(uuid.UUID),
		ExperienceID:  expID,
		BookingID:     bookingID,
		OverallRating: req.OverallRating,
		GuideRating:   req.GuideRating,
		ValueRating:   req.ValueRating,
		Comment:       &comment,
		PhotoURLs:     req.PhotoURLs,
	}

	if err := h.reviewRepo.Create(c.Request.Context(), review); err != nil {
		response.InternalError(c, "Không thể tạo đánh giá")
		return
	}

	// Award XP for review
	h.userRepo.AddXP(c.Request.Context(), travelerID.(uuid.UUID), 20)

	response.Created(c, review)
}

func (h *ReviewHandler) ListByExperience(c *gin.Context) {
	expID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "10"))

	reviews, total, err := h.reviewRepo.ListByExperience(c.Request.Context(), expID, page, perPage)
	if err != nil {
		response.InternalError(c, "Không thể tải đánh giá")
		return
	}

	// Get summary
	summary, _ := h.reviewRepo.GetReviewSummary(c.Request.Context(), expID)

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	response.OK(c, gin.H{
		"reviews": reviews,
		"summary": summary,
		"meta": response.Meta{
			Page:       page,
			PerPage:    perPage,
			Total:      total,
			TotalPages: totalPages,
		},
	})
}

// ============================================
// Favorite Handler
// ============================================

type FavoriteHandler struct {
	favRepo *repository.FavoriteRepository
}

func NewFavoriteHandler(favRepo *repository.FavoriteRepository) *FavoriteHandler {
	return &FavoriteHandler{favRepo: favRepo}
}

func (h *FavoriteHandler) Toggle(c *gin.Context) {
	expID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	isFavorited, err := h.favRepo.Toggle(c.Request.Context(), userID.(uuid.UUID), expID)
	if err != nil {
		response.InternalError(c, "Không thể cập nhật yêu thích")
		return
	}

	msg := "Đã thêm vào yêu thích"
	if !isFavorited {
		msg = "Đã xoá khỏi yêu thích"
	}

	response.OK(c, gin.H{
		"is_favorited": isFavorited,
		"message":      msg,
	})
}

func (h *FavoriteHandler) List(c *gin.Context) {
	userID, _ := c.Get("user_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	experiences, total, err := h.favRepo.ListByUser(c.Request.Context(), userID.(uuid.UUID), page, perPage)
	if err != nil {
		response.InternalError(c, "Không thể tải danh sách yêu thích")
		return
	}

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	response.Paginated(c, experiences, response.Meta{
		Page:       page,
		PerPage:    perPage,
		Total:      total,
		TotalPages: totalPages,
	})
}

// ============================================
// Guide Handler
// ============================================

type GuideHandler struct {
	guideRepo *repository.GuideProfileRepository
	expRepo   *repository.ExperienceRepository
}

func NewGuideHandler(guideRepo *repository.GuideProfileRepository, expRepo *repository.ExperienceRepository) *GuideHandler {
	return &GuideHandler{guideRepo: guideRepo, expRepo: expRepo}
}

func (h *GuideHandler) GetProfile(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	profile, err := h.guideRepo.GetByUserID(c.Request.Context(), userID)
	if err != nil || profile == nil {
		response.NotFound(c, "Hướng dẫn viên không tồn tại")
		return
	}

	// Get guide's experiences
	experiences, _, err := h.expRepo.List(c.Request.Context(), repository.ExperienceFilter{
		GuideID: &userID,
		Page:    1,
		PerPage: 10,
	})

	response.OK(c, gin.H{
		"guide":       profile,
		"experiences": experiences,
	})
}

func (h *GuideHandler) TopGuides(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	guides, err := h.guideRepo.GetTopGuides(c.Request.Context(), limit)
	if err != nil {
		response.InternalError(c, "Không thể tải danh sách hướng dẫn viên")
		return
	}

	response.OK(c, gin.H{"guides": guides})
}

// UpdateProfile — guide creates or updates their own profile
func (h *GuideHandler) UpdateProfile(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req struct {
		Specialties      []string `json:"specialties"`
		ExperienceYears  int      `json:"experience_years" binding:"min=0,max=50"`
		ResponseTimeMins int      `json:"response_time_mins" binding:"min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ: "+err.Error())
		return
	}

	gp := &model.GuideProfile{
		UserID:           userID.(uuid.UUID),
		Specialties:      req.Specialties,
		ExperienceYears:  req.ExperienceYears,
		ResponseTimeMins: req.ResponseTimeMins,
	}

	if err := h.guideRepo.CreateOrUpdate(c.Request.Context(), gp); err != nil {
		response.InternalError(c, "Không thể cập nhật hồ sơ hướng dẫn viên")
		return
	}

	// Re-fetch with user info
	profile, _ := h.guideRepo.GetByUserID(c.Request.Context(), userID.(uuid.UUID))

	response.OK(c, gin.H{"guide": profile, "message": "Đã cập nhật hồ sơ hướng dẫn viên"})
}
