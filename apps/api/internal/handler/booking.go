package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/huetravel/api/internal/service"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Booking Handler
// ============================================

type BookingHandler struct {
	bookingService *service.BookingService
}

func NewBookingHandler(bookingService *service.BookingService) *BookingHandler {
	return &BookingHandler{bookingService: bookingService}
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

	bookings, total, err := h.bookingService.ListTravelerBookings(
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

	booking, err := h.bookingService.GetBooking(c.Request.Context(), id)
	if err != nil {
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

// Confirm — guide confirms a pending booking
func (h *BookingHandler) Confirm(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")

	if err := h.bookingService.ConfirmBooking(c.Request.Context(), id, userID.(uuid.UUID)); err != nil {
		response.BadRequest(c, "HT-BOOK-003", err.Error())
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

	if err := h.bookingService.CompleteBooking(c.Request.Context(), id, userID.(uuid.UUID)); err != nil {
		response.BadRequest(c, "HT-BOOK-004", err.Error())
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

	bookings, total, err := h.bookingService.ListGuideBookings(
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
