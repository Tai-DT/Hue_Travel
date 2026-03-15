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
// Experience Handler
// ============================================

type ExperienceHandler struct {
	expRepo *repository.ExperienceRepository
}

func NewExperienceHandler(expRepo *repository.ExperienceRepository) *ExperienceHandler {
	return &ExperienceHandler{expRepo: expRepo}
}

func (h *ExperienceHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	minPrice, _ := strconv.ParseInt(c.Query("min_price"), 10, 64)
	maxPrice, _ := strconv.ParseInt(c.Query("max_price"), 10, 64)

	var guideID *uuid.UUID
	if guideIDStr := c.Query("guide_id"); guideIDStr != "" {
		parsedGuideID, err := uuid.Parse(guideIDStr)
		if err != nil {
			response.BadRequest(c, "HT-VAL-001", "Guide ID không hợp lệ")
			return
		}
		guideID = &parsedGuideID
	}

	filter := repository.ExperienceFilter{
		Category: c.Query("category"),
		MinPrice: minPrice,
		MaxPrice: maxPrice,
		GuideID:  guideID,
		Search:   c.Query("q"),
		SortBy:   c.DefaultQuery("sort", "rating"),
		Page:     page,
		PerPage:  perPage,
	}

	experiences, total, err := h.expRepo.List(c.Request.Context(), filter)
	if err != nil {
		response.InternalError(c, "Không thể tải danh sách trải nghiệm")
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

func (h *ExperienceHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	exp, err := h.expRepo.GetByID(c.Request.Context(), id)
	if err != nil || exp == nil {
		response.NotFound(c, "Trải nghiệm không tồn tại")
		return
	}

	response.OK(c, exp)
}

func (h *ExperienceHandler) Create(c *gin.Context) {
	var req struct {
		Title        string   `json:"title" binding:"required"`
		Description  string   `json:"description" binding:"required"`
		Category     string   `json:"category" binding:"required"`
		Price        int64    `json:"price" binding:"required,min=10000"`
		MaxGuests    int      `json:"max_guests" binding:"required,min=1,max=50"`
		DurationMins int      `json:"duration_mins" binding:"required,min=30"`
		MeetingPoint string   `json:"meeting_point" binding:"required"`
		MeetingLat   float64  `json:"meeting_lat" binding:"required"`
		MeetingLng   float64  `json:"meeting_lng" binding:"required"`
		Includes     []string `json:"includes"`
		Highlights   []string `json:"highlights"`
		ImageURLs    []string `json:"image_urls"`
		IsInstant    bool     `json:"is_instant"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ: "+err.Error())
		return
	}

	guideID, _ := c.Get("user_id")

	exp := &model.Experience{
		GuideID:      guideID.(uuid.UUID),
		Title:        req.Title,
		Description:  req.Description,
		Category:     model.CategoryType(req.Category),
		Price:        req.Price,
		MaxGuests:    req.MaxGuests,
		DurationMins: req.DurationMins,
		MeetingPoint: req.MeetingPoint,
		MeetingLat:   req.MeetingLat,
		MeetingLng:   req.MeetingLng,
		Includes:     req.Includes,
		Highlights:   req.Highlights,
		ImageURLs:    req.ImageURLs,
		IsInstant:    req.IsInstant,
	}

	if err := h.expRepo.Create(c.Request.Context(), exp); err != nil {
		response.InternalError(c, "Không thể tạo trải nghiệm")
		return
	}

	response.Created(c, exp)
}

// Delete — soft delete experience (set is_active = false)
func (h *ExperienceHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	// Ownership check
	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")

	ownerID, err := h.expRepo.GetOwnerID(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Trải nghiệm không tồn tại")
		return
	}

	if ownerID != userID.(uuid.UUID) && userRole.(string) != "admin" {
		response.Forbidden(c, "Bạn không có quyền xoá trải nghiệm này")
		return
	}

	err = h.expRepo.SoftDelete(c.Request.Context(), id)
	if err != nil {
		response.InternalError(c, "Không thể xoá trải nghiệm")
		return
	}

	response.OK(c, gin.H{"message": "Đã xoá trải nghiệm", "id": id})
}

func (h *ExperienceHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	// Check if experience exists
	existing, err := h.expRepo.GetByID(c.Request.Context(), id)
	if err != nil || existing == nil {
		response.NotFound(c, "Trải nghiệm không tồn tại")
		return
	}

	// Check ownership: only the guide who created it (or admin) can update
	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")
	if existing.GuideID != userID.(uuid.UUID) && userRole.(string) != "admin" {
		response.Forbidden(c, "Bạn không có quyền cập nhật trải nghiệm này")
		return
	}

	var req struct {
		Title        *string  `json:"title"`
		Description  *string  `json:"description"`
		Category     *string  `json:"category"`
		Price        *int64   `json:"price"`
		MaxGuests    *int     `json:"max_guests"`
		DurationMins *int     `json:"duration_mins"`
		MeetingPoint *string  `json:"meeting_point"`
		MeetingLat   *float64 `json:"meeting_lat"`
		MeetingLng   *float64 `json:"meeting_lng"`
		Includes     []string `json:"includes"`
		Highlights   []string `json:"highlights"`
		ImageURLs    []string `json:"image_urls"`
		IsInstant    *bool    `json:"is_instant"`
		IsActive     *bool    `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ: "+err.Error())
		return
	}

	// Apply partial updates
	if req.Title != nil {
		existing.Title = *req.Title
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if req.Category != nil {
		existing.Category = model.CategoryType(*req.Category)
	}
	if req.Price != nil {
		if *req.Price < 10000 {
			response.BadRequest(c, "HT-VAL-001", "Giá tối thiểu là 10,000 VND")
			return
		}
		existing.Price = *req.Price
	}
	if req.MaxGuests != nil {
		existing.MaxGuests = *req.MaxGuests
	}
	if req.DurationMins != nil {
		existing.DurationMins = *req.DurationMins
	}
	if req.MeetingPoint != nil {
		existing.MeetingPoint = *req.MeetingPoint
	}
	if req.MeetingLat != nil {
		existing.MeetingLat = *req.MeetingLat
	}
	if req.MeetingLng != nil {
		existing.MeetingLng = *req.MeetingLng
	}
	if req.Includes != nil {
		existing.Includes = req.Includes
	}
	if req.Highlights != nil {
		existing.Highlights = req.Highlights
	}
	if req.ImageURLs != nil {
		existing.ImageURLs = req.ImageURLs
	}
	if req.IsInstant != nil {
		existing.IsInstant = *req.IsInstant
	}
	if req.IsActive != nil {
		existing.IsActive = *req.IsActive
	}

	if err := h.expRepo.Update(c.Request.Context(), existing); err != nil {
		response.InternalError(c, "Không thể cập nhật trải nghiệm")
		return
	}

	response.OK(c, existing)
}
