package handler

import (
	"errors"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/internal/service"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Payment Handler
// ============================================

type PaymentHandler struct {
	vnpayService *service.VNPayService
	bookingRepo  *repository.BookingRepository
	userRepo     *repository.UserRepository
}

func NewPaymentHandler(vnpay *service.VNPayService, bookingRepo *repository.BookingRepository, userRepo *repository.UserRepository) *PaymentHandler {
	return &PaymentHandler{
		vnpayService: vnpay,
		bookingRepo:  bookingRepo,
		userRepo:     userRepo,
	}
}

// CreatePayment — tạo link thanh toán VNPay
func (h *PaymentHandler) CreatePayment(c *gin.Context) {
	var req struct {
		BookingID string `json:"booking_id" binding:"required"`
		BankCode  string `json:"bank_code"` // optional: VNPAYQR, VNBANK, INTCARD
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu booking_id")
		return
	}

	bookingID, err := uuid.Parse(req.BookingID)
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Booking ID không hợp lệ")
		return
	}

	// Get booking details
	booking, err := h.bookingRepo.GetByID(c.Request.Context(), bookingID)
	if err != nil || booking == nil {
		response.NotFound(c, "Booking không tồn tại")
		return
	}

	// Verify booking belongs to user
	userID, _ := c.Get("user_id")
	if booking.TravelerID != userID.(uuid.UUID) {
		response.Forbidden(c, "Không có quyền thanh toán booking này")
		return
	}

	// Check booking status
	if booking.Status != "pending" {
		response.BadRequest(c, "HT-PAY-001", "Booking không ở trạng thái chờ thanh toán")
		return
	}

	totalAmount := booking.TotalPrice

	paymentReq := service.PaymentRequest{
		BookingID:   bookingID,
		Amount:      totalAmount,
		Description: fmt.Sprintf("Thanh toan Hue Travel booking %s", bookingID.String()[:8]),
		ClientIP:    c.ClientIP(),
		BankCode:    req.BankCode,
	}

	result, err := h.vnpayService.CreatePaymentURL(paymentReq)
	if err != nil {
		if errors.Is(err, service.ErrServiceNotConfigured) || errors.Is(err, service.ErrServiceUnavailable) {
			response.ServiceUnavailable(c, "HT-PAY-003", "Cổng thanh toán hiện chưa sẵn sàng")
			return
		}
		response.InternalError(c, "Không thể tạo thanh toán")
		return
	}

	if !h.vnpayService.IsConfigured() {
		now := time.Now()
		_ = h.bookingRepo.UpdateStatus(c.Request.Context(), bookingID, "confirmed")
		_ = h.bookingRepo.UpdatePaymentInfo(c.Request.Context(), bookingID, result.TxnRef, &now)
		_ = h.userRepo.AddXP(c.Request.Context(), booking.TravelerID, 50)

		response.OK(c, gin.H{
			"payment_url": result.PaymentURL,
			"txn_ref":     result.TxnRef,
			"amount":      totalAmount,
			"expires_in":  900,
			"status":      "success",
			"message":     "Mock payment thành công. Booking đã được xác nhận.",
		})
		return
	}

	// Update booking with payment ref
	h.bookingRepo.UpdatePaymentRef(c.Request.Context(), bookingID, result.TxnRef)

	response.OK(c, gin.H{
		"payment_url": result.PaymentURL,
		"txn_ref":     result.TxnRef,
		"amount":      totalAmount,
		"expires_in":  900, // 15 minutes
	})
}

// PaymentCallback — VNPay gọi sau khi thanh toán
func (h *PaymentHandler) PaymentCallback(c *gin.Context) {
	// VNPay sends params via GET
	isValid, callback := h.vnpayService.VerifyCallback(c.Request.URL.Query())

	if !isValid || callback == nil {
		response.BadRequest(c, "HT-PAY-002", "Thanh toán không hợp lệ")
		return
	}

	// Find booking by txn ref
	booking, err := h.bookingRepo.GetByPaymentRef(c.Request.Context(), callback.TxnRef)
	if err != nil || booking == nil {
		response.NotFound(c, "Không tìm thấy booking")
		return
	}

	if callback.IsSuccess() {
		// Payment successful — confirm booking
		now := time.Now()
		h.bookingRepo.UpdateStatus(c.Request.Context(), booking.ID, "confirmed")
		h.bookingRepo.UpdatePaymentInfo(c.Request.Context(), booking.ID, callback.TransactionNo, &now)

		// Award XP to traveler
		h.userRepo.AddXP(c.Request.Context(), booking.TravelerID, 50)

		response.OK(c, gin.H{
			"status":         "success",
			"message":        "Thanh toán thành công! Booking đã được xác nhận.",
			"booking_id":     booking.ID,
			"transaction_no": callback.TransactionNo,
		})
	} else {
		// Payment failed
		response.OK(c, gin.H{
			"status":  "failed",
			"message": service.VNPayResponseMessage(callback.ResponseCode),
			"code":    callback.ResponseCode,
		})
	}
}

// PaymentMethods — danh sách phương thức thanh toán
func (h *PaymentHandler) PaymentMethods(c *gin.Context) {
	methods := []gin.H{
		{
			"code":        "VNPAYQR",
			"name":        "VNPay QR",
			"description": "Quét mã QR bằng app ngân hàng",
			"icon":        "📱",
			"recommended": true,
		},
		{
			"code":        "VNBANK",
			"name":        "ATM/Internet Banking",
			"description": "Thẻ ATM của ngân hàng nội địa",
			"icon":        "🏦",
			"recommended": false,
		},
		{
			"code":        "INTCARD",
			"name":        "Visa/Mastercard",
			"description": "Thẻ quốc tế Visa, Mastercard, JCB",
			"icon":        "💳",
			"recommended": false,
		},
	}

	response.OK(c, gin.H{"methods": methods})
}
