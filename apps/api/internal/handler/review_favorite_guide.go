package handler

import (
	"fmt"
	"strconv"
	"strings"

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
	expID, err := uuid.Parse(req.ExperienceID)
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "experience_id không hợp lệ")
		return
	}
	bookingID, err := uuid.Parse(req.BookingID)
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "booking_id không hợp lệ")
		return
	}
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

const directGuideTitlePrefix = "Thuê guide riêng cùng "

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

func (h *GuideHandler) GetDirectBookingExperience(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	profile, err := h.guideRepo.GetByUserID(c.Request.Context(), userID)
	if err != nil || profile == nil || !profile.IsApproved {
		response.NotFound(c, "Hướng dẫn viên không tồn tại")
		return
	}

	experiences, _, err := h.expRepo.List(c.Request.Context(), repository.ExperienceFilter{
		GuideID: &userID,
		Page:    1,
		PerPage: 50,
		SortBy:  "price_asc",
	})
	if err != nil {
		response.InternalError(c, "Không thể tải danh sách trải nghiệm của hướng dẫn viên")
		return
	}

	if existing := findDirectBookingExperience(experiences); existing != nil {
		existing.Guide = buildGuideUser(profile)
		response.OK(c, gin.H{
			"guide":      profile,
			"experience": existing,
		})
		return
	}

	directExp := buildDirectBookingExperience(userID, profile, findBaseGuideExperience(experiences))
	if err := h.expRepo.Create(c.Request.Context(), directExp); err != nil {
		response.InternalError(c, "Không thể tạo phiên đặt hướng dẫn viên trực tiếp")
		return
	}

	directExp.Guide = buildGuideUser(profile)

	response.OK(c, gin.H{
		"guide":      profile,
		"experience": directExp,
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

func findDirectBookingExperience(experiences []model.Experience) *model.Experience {
	for i := range experiences {
		if isDirectBookingExperience(experiences[i]) {
			return &experiences[i]
		}
	}
	return nil
}

func findBaseGuideExperience(experiences []model.Experience) *model.Experience {
	for i := range experiences {
		if !isDirectBookingExperience(experiences[i]) {
			return &experiences[i]
		}
	}
	return nil
}

func isDirectBookingExperience(exp model.Experience) bool {
	return strings.HasPrefix(exp.Title, directGuideTitlePrefix)
}

func buildGuideUser(profile *model.GuideProfile) *model.User {
	if profile == nil {
		return nil
	}

	guide := &model.User{ID: profile.UserID}
	if profile.User != nil {
		guide.FullName = profile.User.FullName
		guide.AvatarURL = profile.User.AvatarURL
		guide.Bio = profile.User.Bio
		guide.Languages = profile.User.Languages
	}
	return guide
}

func buildDirectBookingExperience(userID uuid.UUID, profile *model.GuideProfile, base *model.Experience) *model.Experience {
	const (
		defaultPrice        int64   = 499000
		defaultDuration             = 240
		defaultMaxGuests            = 6
		defaultMeetingLat   float64 = 16.4637
		defaultMeetingLng   float64 = 107.5909
		defaultMeetingPoint         = "Điểm hẹn linh hoạt tại trung tâm Huế"
	)

	guideName := "guide địa phương Huế"
	if profile != nil && profile.User != nil && strings.TrimSpace(profile.User.FullName) != "" {
		guideName = profile.User.FullName
	}

	price := defaultPrice
	duration := defaultDuration
	maxGuests := defaultMaxGuests
	meetingPoint := defaultMeetingPoint
	meetingLat := defaultMeetingLat
	meetingLng := defaultMeetingLng
	includes := []string{
		"Lịch trình linh hoạt theo nhu cầu",
		"Tư vấn điểm ăn chơi bản địa",
		"Hỗ trợ điều phối trong chuyến đi",
	}
	highlights := []string{
		"Trải nghiệm Huế theo nhịp riêng của bạn",
		"Guide bản địa đồng hành 1:1 hoặc theo nhóm nhỏ",
	}
	imageURLs := []string{}

	if base != nil {
		if base.Price > 0 {
			price = base.Price
		}
		if base.DurationMins > 0 {
			duration = base.DurationMins
		}
		if base.MaxGuests > 0 {
			maxGuests = base.MaxGuests
		}
		if strings.TrimSpace(base.MeetingPoint) != "" {
			meetingPoint = base.MeetingPoint
		}
		if base.MeetingLat != 0 {
			meetingLat = base.MeetingLat
		}
		if base.MeetingLng != 0 {
			meetingLng = base.MeetingLng
		}
		if len(base.Includes) > 0 {
			includes = base.Includes
		}
		if len(base.Highlights) > 0 {
			highlights = base.Highlights
		}
		if len(base.ImageURLs) > 0 {
			imageURLs = base.ImageURLs
		}
	}

	if profile != nil && len(profile.Specialties) > 0 {
		highlights = append(highlights, profile.Specialties...)
	}

	description := fmt.Sprintf(
		"Đặt buổi đồng hành riêng cùng %s để khám phá Huế theo lịch trình linh hoạt. Bạn có thể dùng booking này cho city tour riêng, food tour, check-in, hoặc nhờ guide tư vấn hành trình tại chỗ.",
		guideName,
	)
	if profile != nil && profile.User != nil && profile.User.Bio != nil && strings.TrimSpace(*profile.User.Bio) != "" {
		description = description + "\n\nVề guide: " + strings.TrimSpace(*profile.User.Bio)
	}

	return &model.Experience{
		GuideID:      userID,
		Title:        directGuideTitlePrefix + guideName,
		Description:  description,
		Category:     model.CatExperience,
		Price:        price,
		MaxGuests:    maxGuests,
		DurationMins: duration,
		MeetingPoint: meetingPoint,
		MeetingLat:   meetingLat,
		MeetingLng:   meetingLng,
		Includes:     includes,
		Highlights:   highlights,
		ImageURLs:    imageURLs,
		IsInstant:    true,
		IsActive:     true,
	}
}
