package handler

import (
	"errors"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/huetravel/api/internal/model"
	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/internal/service"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// File Upload Handler
// ============================================

type UploadHandler struct {
	uploadSvc *service.FileUploadService
}

func NewUploadHandler(uploadSvc *service.FileUploadService) *UploadHandler {
	return &UploadHandler{uploadSvc: uploadSvc}
}

// UploadFile — upload single file (avatar, review photo, etc.)
func (h *UploadHandler) UploadFile(c *gin.Context) {
	folder := c.DefaultPostForm("folder", "uploads")

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Vui lòng chọn file để upload")
		return
	}
	defer file.Close()

	// Validate
	if err := h.uploadSvc.ValidateUpload(header.Filename, header.Size, nil); err != nil {
		response.BadRequest(c, "HT-VAL-002", err.Error())
		return
	}

	result, err := h.uploadSvc.Upload(c.Request.Context(), folder, header.Filename, file, header.Size)
	if err != nil {
		if errors.Is(err, service.ErrServiceNotConfigured) || errors.Is(err, service.ErrServiceUnavailable) {
			response.ServiceUnavailable(c, "HT-UP-001", "Dịch vụ upload hiện chưa sẵn sàng")
			return
		}
		response.InternalError(c, "Không thể upload file: "+err.Error())
		return
	}

	response.OK(c, result)
}

// UploadAvatar — upload avatar
func (h *UploadHandler) UploadAvatar(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Vui lòng chọn ảnh đại diện")
		return
	}
	defer file.Close()

	allowedTypes := []string{".jpg", ".jpeg", ".png", ".webp"}
	if err := h.uploadSvc.ValidateUpload(header.Filename, header.Size, allowedTypes); err != nil {
		response.BadRequest(c, "HT-VAL-002", err.Error())
		return
	}

	userID, _ := c.Get("user_id")
	folder := "avatars/" + userID.(uuid.UUID).String()[:8]

	result, err := h.uploadSvc.Upload(c.Request.Context(), folder, header.Filename, file, header.Size)
	if err != nil {
		if errors.Is(err, service.ErrServiceNotConfigured) || errors.Is(err, service.ErrServiceUnavailable) {
			response.ServiceUnavailable(c, "HT-UP-002", "Dịch vụ upload avatar hiện chưa sẵn sàng")
			return
		}
		response.InternalError(c, "Không thể upload avatar")
		return
	}

	response.OK(c, result)
}

// ============================================
// Admin Management Handler
// ============================================

type AdminManagementHandler struct {
	userRepo    *repository.UserRepository
	expRepo     *repository.ExperienceRepository
	bookingRepo *repository.BookingRepository
	reviewRepo  *repository.ReviewRepository
	storyRepo   *repository.StoryRepository
}

func NewAdminManagementHandler(
	userRepo *repository.UserRepository,
	expRepo *repository.ExperienceRepository,
	bookingRepo *repository.BookingRepository,
	reviewRepo *repository.ReviewRepository,
	storyRepo *repository.StoryRepository,
) *AdminManagementHandler {
	return &AdminManagementHandler{
		userRepo:    userRepo,
		expRepo:     expRepo,
		bookingRepo: bookingRepo,
		reviewRepo:  reviewRepo,
		storyRepo:   storyRepo,
	}
}

// ---- Users ----

func (h *AdminManagementHandler) ListUsers(c *gin.Context) {
	search := c.Query("q")
	role := c.Query("role")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	users, total, err := h.userRepo.ListUsers(c.Request.Context(), search, role, page, perPage)
	if err != nil {
		response.InternalError(c, "Không thể tải danh sách users")
		return
	}

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	response.Paginated(c, users, response.Meta{
		Page:       page,
		PerPage:    perPage,
		Total:      total,
		TotalPages: totalPages,
	})
}

func (h *AdminManagementHandler) GetUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	user, err := h.userRepo.GetByID(c.Request.Context(), id)
	if err != nil || user == nil {
		response.NotFound(c, "User không tồn tại")
		return
	}

	response.OK(c, user)
}

func (h *AdminManagementHandler) BanUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	var req struct {
		Active bool `json:"active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ")
		return
	}

	err = h.userRepo.SetActive(c.Request.Context(), id, req.Active)
	if err != nil {
		response.InternalError(c, "Không thể cập nhật trạng thái user")
		return
	}

	action := "Đã kích hoạt user"
	if !req.Active {
		action = "Đã khoá user"
	}
	response.OK(c, gin.H{"message": action, "id": id, "active": req.Active})
}

func (h *AdminManagementHandler) ChangeRole(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu role")
		return
	}

	// Validate role
	validRoles := map[string]bool{
		string(model.RoleTraveler): true,
		string(model.RoleGuide):    true,
		string(model.RoleBlogger):  true,
		string(model.RoleMerchant): true,
		string(model.RoleExpert):   true,
		string(model.RoleAdmin):    true,
	}
	if !validRoles[req.Role] {
		response.BadRequest(c, "HT-VAL-002", "Role không hợp lệ")
		return
	}

	err = h.userRepo.SetRole(c.Request.Context(), id, req.Role)
	if err != nil {
		response.InternalError(c, "Không thể cập nhật role")
		return
	}

	response.OK(c, gin.H{"message": "Đã cập nhật role", "id": id, "role": req.Role})
}

// ---- Experiences ----

func (h *AdminManagementHandler) ListExperiences(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	filter := repository.ExperienceFilter{
		Category:        c.Query("category"),
		Search:          c.Query("q"),
		SortBy:          c.DefaultQuery("sort", "created_at"),
		Page:            page,
		PerPage:         perPage,
		IncludeInactive: c.DefaultQuery("include_inactive", "true") == "true",
	}

	experiences, total, err := h.expRepo.List(c.Request.Context(), filter)
	if err != nil {
		response.InternalError(c, "Không thể tải danh sách")
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

func (h *AdminManagementHandler) DeleteExperience(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	err = h.expRepo.SoftDelete(c.Request.Context(), id)
	if err != nil {
		response.InternalError(c, "Không thể xoá trải nghiệm")
		return
	}

	response.OK(c, gin.H{"message": "Đã xoá trải nghiệm", "id": id})
}

// ---- Reviews ----

func (h *AdminManagementHandler) ListReviews(c *gin.Context) {
	if h.reviewRepo == nil {
		response.ServiceUnavailable(c, "HT-REV-001", "Dịch vụ đánh giá hiện chưa sẵn sàng")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	maxRating, _ := strconv.ParseFloat(c.DefaultQuery("max_rating", "0"), 64)

	filter := repository.AdminReviewFilter{
		FeaturedOnly: c.DefaultQuery("featured", "0") == "1" || c.DefaultQuery("featured", "false") == "true",
		MaxRating:    maxRating,
		Page:         page,
		PerPage:      perPage,
	}

	reviews, total, err := h.reviewRepo.ListAdmin(c.Request.Context(), filter)
	if err != nil {
		response.InternalError(c, "Không thể tải danh sách đánh giá")
		return
	}

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	response.Paginated(c, reviews, response.Meta{
		Page:       page,
		PerPage:    perPage,
		Total:      total,
		TotalPages: totalPages,
	})
}

func (h *AdminManagementHandler) ToggleFeaturedReview(c *gin.Context) {
	if h.reviewRepo == nil {
		response.ServiceUnavailable(c, "HT-REV-001", "Dịch vụ đánh giá hiện chưa sẵn sàng")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	var req struct {
		IsFeatured bool `json:"is_featured"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ")
		return
	}

	if err := h.reviewRepo.SetFeatured(c.Request.Context(), id, req.IsFeatured); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			response.NotFound(c, "Đánh giá không tồn tại")
			return
		}
		response.InternalError(c, "Không thể cập nhật đánh giá")
		return
	}

	response.OK(c, gin.H{"message": "Đã cập nhật trạng thái nổi bật", "id": id, "is_featured": req.IsFeatured})
}

func (h *AdminManagementHandler) DeleteReview(c *gin.Context) {
	if h.reviewRepo == nil {
		response.ServiceUnavailable(c, "HT-REV-001", "Dịch vụ đánh giá hiện chưa sẵn sàng")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	if err := h.reviewRepo.DeleteAdmin(c.Request.Context(), id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			response.NotFound(c, "Đánh giá không tồn tại")
			return
		}
		response.InternalError(c, "Không thể xoá đánh giá")
		return
	}

	response.OK(c, gin.H{"message": "Đã xoá đánh giá", "id": id})
}

// ---- Bookings ----

func (h *AdminManagementHandler) ListBookings(c *gin.Context) {
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	days, _ := strconv.Atoi(c.DefaultQuery("days", "0"))

	var startDate *time.Time
	if days > 0 {
		start := time.Now().AddDate(0, 0, -days)
		startDate = &start
	}

	bookings, total, err := h.bookingRepo.ListAll(c.Request.Context(), status, page, perPage, startDate)
	if err != nil {
		response.InternalError(c, "Không thể tải danh sách bookings")
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

func (h *AdminManagementHandler) UpdateBookingStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu status")
		return
	}

	validStatuses := map[string]bool{
		string(model.BookingPending):   true,
		string(model.BookingConfirmed): true,
		string(model.BookingCompleted): true,
		string(model.BookingCancelled): true,
		string(model.BookingRefunded):  true,
	}
	if !validStatuses[req.Status] {
		response.BadRequest(c, "HT-VAL-002", "Trạng thái không hợp lệ")
		return
	}

	err = h.bookingRepo.UpdateStatus(c.Request.Context(), id, model.BookingStatus(req.Status))
	if err != nil {
		response.InternalError(c, "Không thể cập nhật booking")
		return
	}

	response.OK(c, gin.H{"message": "Đã cập nhật booking", "id": id, "status": req.Status})
}

// ---- Stories ----

func (h *AdminManagementHandler) ListStories(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	stories, err := h.storyRepo.FeedAdmin(c.Request.Context(), limit, offset)
	if err != nil {
		response.InternalError(c, "Không thể tải stories")
		return
	}
	if stories == nil {
		stories = []repository.Story{}
	}

	response.OK(c, gin.H{"stories": stories, "total": len(stories)})
}

func (h *AdminManagementHandler) DeleteStory(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	if err := h.storyRepo.DeleteAdmin(c.Request.Context(), id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			response.NotFound(c, "Story không tồn tại")
			return
		}
		response.InternalError(c, "Không thể xóa story")
		return
	}

	response.OK(c, gin.H{"message": "Đã xóa story"})
}
