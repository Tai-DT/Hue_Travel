package handler

import (
	"fmt"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/huetravel/api/internal/model"
	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/internal/service"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Health Handler
// ============================================

type HealthHandler struct{}

func NewHealthHandler() *HealthHandler {
	return &HealthHandler{}
}

func (h *HealthHandler) Check(c *gin.Context) {
	response.OK(c, gin.H{
		"status":  "healthy",
		"service": "hue-travel-api",
		"version": "1.0.0",
	})
}

// ============================================
// Auth Handler
// ============================================

type AuthHandler struct {
	authService *service.AuthService
	userRepo    *repository.UserRepository
	redis       *redis.Client
}

func NewAuthHandler(authService *service.AuthService, userRepo *repository.UserRepository, rdb *redis.Client) *AuthHandler {
	return &AuthHandler{authService: authService, userRepo: userRepo, redis: rdb}
}

func (h *AuthHandler) SendOTP(c *gin.Context) {
	var req service.SendOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Số điện thoại không hợp lệ")
		return
	}

	if err := h.authService.SendOTP(c.Request.Context(), req); err != nil {
		response.BadRequest(c, "HT-AUTH-002", err.Error())
		return
	}

	response.OK(c, gin.H{
		"message":    "OTP đã được gửi",
		"expires_in": 300,
	})
}

func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	var req service.VerifyOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ")
		return
	}

	result, err := h.authService.VerifyOTP(c.Request.Context(), req)
	if err != nil {
		response.BadRequest(c, "HT-AUTH-004", err.Error())
		return
	}

	response.OK(c, result)
}

func (h *AuthHandler) GoogleLogin(c *gin.Context) {
	var req struct {
		IDToken string `json:"id_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Token không hợp lệ")
		return
	}

	result, err := h.authService.GoogleLogin(c.Request.Context(), req.IDToken)
	if err != nil {
		response.BadRequest(c, "HT-AUTH-005", err.Error())
		return
	}

	response.OK(c, result)
}

func (h *AuthHandler) RefreshToken(c *gin.Context) {
	userID, _ := c.Get("user_id")
	role, _ := c.Get("user_role")

	result, err := h.authService.RefreshToken(c.Request.Context(), userID.(uuid.UUID), role.(string))
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	response.OK(c, result)
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "Chưa xác thực")
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), userID.(uuid.UUID))
	if err != nil || user == nil {
		response.NotFound(c, "Không tìm thấy người dùng")
		return
	}

	response.OK(c, gin.H{"user": user})
}

// UpdateProfile — cập nhật thông tin cá nhân
func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "Chưa xác thực")
		return
	}

	var req struct {
		FullName  string   `json:"full_name" binding:"required,min=2"`
		Bio       *string  `json:"bio"`
		AvatarURL *string  `json:"avatar_url"`
		Languages []string `json:"languages"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ: "+err.Error())
		return
	}

	err := h.userRepo.UpdateProfile(c.Request.Context(), userID.(uuid.UUID), req.FullName, req.Bio, req.AvatarURL, req.Languages)
	if err != nil {
		response.InternalError(c, "Không thể cập nhật")
		return
	}

	// Return updated user
	user, _ := h.userRepo.GetByID(c.Request.Context(), userID.(uuid.UUID))
	response.OK(c, gin.H{"user": user, "message": "Đã cập nhật thông tin"})
}

// Logout — invalidate refresh token
func (h *AuthHandler) Logout(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "Chưa xác thực")
		return
	}

	if h.redis != nil {
		h.redis.Del(c.Request.Context(), fmt.Sprintf("refresh:%s", userID.(uuid.UUID).String()))
	}

	response.OK(c, gin.H{"message": "Đã đăng xuất"})
}

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

	filter := repository.ExperienceFilter{
		Category: c.Query("category"),
		MinPrice: minPrice,
		MaxPrice: maxPrice,
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

// ============================================
// Place Handler
// ============================================

type PlaceHandler struct {
	placesSvc *service.GooglePlacesService
}

func NewPlaceHandler(placesSvc *service.GooglePlacesService) *PlaceHandler {
	return &PlaceHandler{placesSvc: placesSvc}
}

// Huế city center coordinates
const (
	hueCenterLat = 16.4637
	hueCenterLng = 107.5909
)

func (h *PlaceHandler) Search(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		response.BadRequest(c, "HT-VAL-001", "Vui lòng nhập từ khoá tìm kiếm")
		return
	}

	places, err := h.placesSvc.TextSearch(c.Request.Context(), query, hueCenterLat, hueCenterLng)
	if err != nil {
		response.InternalError(c, "Không thể tìm kiếm: "+err.Error())
		return
	}

	response.OK(c, gin.H{
		"query":  query,
		"places": places,
		"total":  len(places),
	})
}

func (h *PlaceHandler) NearbyRestaurants(c *gin.Context) {
	lat := hueCenterLat
	lng := hueCenterLng
	radius := 2000

	if v := c.Query("lat"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			lat = f
		}
	}
	if v := c.Query("lng"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			lng = f
		}
	}
	if v := c.Query("radius"); v != "" {
		if r, err := strconv.Atoi(v); err == nil && r > 0 && r <= 50000 {
			radius = r
		}
	}

	placeType := c.DefaultQuery("type", "restaurant")

	places, err := h.placesSvc.NearbySearch(c.Request.Context(), lat, lng, radius, placeType)
	if err != nil {
		response.InternalError(c, "Không thể tải quán ăn gần đây")
		return
	}

	response.OK(c, gin.H{
		"restaurants": places,
		"total":       len(places),
		"center":      gin.H{"lat": lat, "lng": lng},
		"radius":      radius,
	})
}

func (h *PlaceHandler) GetDirections(c *gin.Context) {
	originLat, _ := strconv.ParseFloat(c.Query("origin_lat"), 64)
	originLng, _ := strconv.ParseFloat(c.Query("origin_lng"), 64)
	destLat, _ := strconv.ParseFloat(c.Query("dest_lat"), 64)
	destLng, _ := strconv.ParseFloat(c.Query("dest_lng"), 64)
	mode := c.DefaultQuery("mode", "driving")

	if originLat == 0 || destLat == 0 {
		response.BadRequest(c, "HT-VAL-001", "Thiếu toạ độ origin/destination")
		return
	}

	dir, err := h.placesSvc.GetDirections(c.Request.Context(), originLat, originLng, destLat, destLng, mode)
	if err != nil {
		response.InternalError(c, "Không thể lấy đường đi")
		return
	}

	response.OK(c, gin.H{"directions": dir})
}

// ============================================
// Booking Handler
// ============================================

type BookingHandler struct {
	bookingService *service.BookingService
	bookingRepo    *repository.BookingRepository
}

func NewBookingHandler(bookingService *service.BookingService, bookingRepo *repository.BookingRepository) *BookingHandler {
	return &BookingHandler{bookingService: bookingService, bookingRepo: bookingRepo}
}

func (h *BookingHandler) Create(c *gin.Context) {
	var req service.CreateBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ: "+err.Error())
		return
	}

	travelerID, _ := c.Get("user_id")

	result, err := h.bookingService.CreateBooking(c.Request.Context(), travelerID.(uuid.UUID), req)
	if err != nil {
		response.BadRequest(c, "HT-BOOK-001", err.Error())
		return
	}

	response.Created(c, result)
}

func (h *BookingHandler) List(c *gin.Context) {
	travelerID, _ := c.Get("user_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "10"))

	bookings, total, err := h.bookingRepo.ListByTraveler(
		c.Request.Context(), travelerID.(uuid.UUID), status, page, perPage)
	if err != nil {
		response.InternalError(c, "Không thể tải danh sách booking")
		return
	}

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	response.Paginated(c, bookings, response.Meta{
		Page:       page,
		PerPage:    perPage,
		Total:      total,
		TotalPages: totalPages,
	})
}

func (h *BookingHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	booking, err := h.bookingRepo.GetByID(c.Request.Context(), id)
	if err != nil || booking == nil {
		response.NotFound(c, "Booking không tồn tại")
		return
	}

	response.OK(c, booking)
}

func (h *BookingHandler) Cancel(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)

	userID, _ := c.Get("user_id")

	if err := h.bookingService.CancelBooking(c.Request.Context(), id, userID.(uuid.UUID), req.Reason); err != nil {
		response.BadRequest(c, "HT-BOOK-002", err.Error())
		return
	}

	response.OK(c, gin.H{"message": "Booking đã được huỷ thành công"})
}

// Confirm — guide confirm booking
func (h *BookingHandler) Confirm(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")

	booking, err := h.bookingRepo.GetByID(c.Request.Context(), id)
	if err != nil || booking == nil {
		response.NotFound(c, "Booking không tồn tại")
		return
	}

	// Only the guide can confirm
	if booking.GuideID != userID.(uuid.UUID) {
		response.Forbidden(c, "Chỉ hướng dẫn viên mới có thể xác nhận booking")
		return
	}

	if booking.Status != model.BookingPending {
		response.BadRequest(c, "HT-BOOK-003", "Booking không ở trạng thái chờ xác nhận")
		return
	}

	err = h.bookingRepo.UpdateStatus(c.Request.Context(), id, model.BookingConfirmed)
	if err != nil {
		response.InternalError(c, "Không thể xác nhận booking")
		return
	}

	response.OK(c, gin.H{"message": "Booking đã được xác nhận", "id": id})
}

// Complete — guide marks tour as completed
func (h *BookingHandler) Complete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")

	booking, err := h.bookingRepo.GetByID(c.Request.Context(), id)
	if err != nil || booking == nil {
		response.NotFound(c, "Booking không tồn tại")
		return
	}

	if booking.GuideID != userID.(uuid.UUID) {
		response.Forbidden(c, "Chỉ hướng dẫn viên mới có thể hoàn thành booking")
		return
	}

	if booking.Status != model.BookingConfirmed && booking.Status != model.BookingActive {
		response.BadRequest(c, "HT-BOOK-004", "Booking chưa được xác nhận")
		return
	}

	err = h.bookingRepo.UpdateStatus(c.Request.Context(), id, model.BookingCompleted)
	if err != nil {
		response.InternalError(c, "Không thể hoàn thành booking")
		return
	}

	response.OK(c, gin.H{"message": "Tour đã hoàn thành! Cảm ơn bạn.", "id": id})
}

// GuideBookings — danh sách booking cho guide
func (h *BookingHandler) GuideBookings(c *gin.Context) {
	guideID, _ := c.Get("user_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "10"))

	bookings, total, err := h.bookingRepo.ListByGuide(
		c.Request.Context(), guideID.(uuid.UUID), status, page, perPage)
	if err != nil {
		response.InternalError(c, "Không thể tải danh sách booking")
		return
	}

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	response.Paginated(c, bookings, response.Meta{
		Page:       page,
		PerPage:    perPage,
		Total:      total,
		TotalPages: totalPages,
	})
}
