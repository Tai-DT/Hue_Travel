package handler

import (
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/huetravel/api/internal/service"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Auth Handler
// ============================================

type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) SendOTP(c *gin.Context) {
	var req service.SendOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Số điện thoại không hợp lệ")
		return
	}

	if err := h.authService.SendOTP(c.Request.Context(), req); err != nil {
		if errors.Is(err, service.ErrServiceNotConfigured) || errors.Is(err, service.ErrServiceUnavailable) {
			response.ServiceUnavailable(c, "HT-AUTH-006", "Dịch vụ OTP hiện chưa sẵn sàng")
			return
		}
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
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.RefreshToken) == "" {
		response.BadRequest(c, "HT-VAL-001", "Thiếu refresh token")
		return
	}

	result, err := h.authService.RefreshToken(c.Request.Context(), req.RefreshToken)
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

	user, err := h.authService.GetUser(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
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
		Email     *string  `json:"email" binding:"omitempty,email"`
		Bio       *string  `json:"bio"`
		AvatarURL *string  `json:"avatar_url"`
		Languages []string `json:"languages"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ: "+err.Error())
		return
	}

	if req.Email != nil {
		email := strings.TrimSpace(*req.Email)
		if email == "" {
			req.Email = nil
		} else {
			req.Email = &email
		}
	}

	user, err := h.authService.UpdateUserProfile(c.Request.Context(), userID.(uuid.UUID), req.FullName, req.Email, req.Bio, req.AvatarURL, req.Languages)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			response.BadRequest(c, "HT-VAL-002", "Email đã được sử dụng")
			return
		}
		response.InternalError(c, "Không thể cập nhật")
		return
	}

	response.OK(c, gin.H{"user": user, "message": "Đã cập nhật thông tin"})
}

// Logout — invalidate refresh token
func (h *AuthHandler) Logout(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "Chưa xác thực")
		return
	}

	h.authService.Logout(c.Request.Context(), userID.(uuid.UUID))
	response.OK(c, gin.H{"message": "Đã đăng xuất"})
}

// DeleteAccount — user self-deactivates account (soft delete)
func (h *AuthHandler) DeleteAccount(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "Chưa xác thực")
		return
	}

	if err := h.authService.DeactivateAccount(c.Request.Context(), userID.(uuid.UUID)); err != nil {
		response.InternalError(c, "Không thể xóa tài khoản")
		return
	}

	response.OK(c, gin.H{"message": "Tài khoản đã được xóa. Bạn có thể liên hệ hỗ trợ để khôi phục."})
}
