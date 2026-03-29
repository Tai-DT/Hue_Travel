package handler

import (
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/huetravel/api/internal/model"
	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/internal/service"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Auth Handler
// ============================================

type AuthHandler struct {
	authService *service.AuthService
	prefRepo    *repository.UserPreferencesRepository
}

func NewAuthHandler(authService *service.AuthService, prefRepo *repository.UserPreferencesRepository) *AuthHandler {
	return &AuthHandler{authService: authService, prefRepo: prefRepo}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req service.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu đăng ký không hợp lệ")
		return
	}

	result, err := h.authService.Register(c.Request.Context(), req)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			response.BadRequest(c, "HT-AUTH-007", "Email đã được sử dụng")
			return
		}
		response.BadRequest(c, "HT-AUTH-007", err.Error())
		return
	}

	response.Created(c, result)
}

func (h *AuthHandler) LoginWithPassword(c *gin.Context) {
	var req service.PasswordLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu đăng nhập không hợp lệ")
		return
	}

	result, err := h.authService.LoginWithPassword(c.Request.Context(), req)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	response.OK(c, result)
}

func (h *AuthHandler) UpdatePassword(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "Chưa xác thực")
		return
	}

	var req service.UpdatePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu mật khẩu không hợp lệ")
		return
	}

	if err := h.authService.UpdatePassword(c.Request.Context(), userID.(uuid.UUID), req); err != nil {
		response.BadRequest(c, "HT-AUTH-008", err.Error())
		return
	}

	response.OK(c, gin.H{"message": "Đã cập nhật mật khẩu"})
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

func (h *AuthHandler) GetPreferences(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "Chưa xác thực")
		return
	}
	uid := userID.(uuid.UUID)

	if h.prefRepo == nil {
		prefs := repository.DefaultUserPreferences(uid)
		response.OK(c, gin.H{
			"preferences":  preferencePayload(prefs),
			"device_count": 1,
			"updated_at":   nil,
		})
		return
	}

	prefs, err := h.prefRepo.Get(c.Request.Context(), uid)
	if err != nil {
		response.InternalError(c, "Không thể tải cài đặt")
		return
	}

	deviceCount, err := h.prefRepo.CountDevices(c.Request.Context(), uid)
	if err != nil {
		deviceCount = 0
	}
	if deviceCount < 1 {
		deviceCount = 1
	}

	var updatedAt interface{}
	if !prefs.UpdatedAt.IsZero() {
		updatedAt = prefs.UpdatedAt
	}

	response.OK(c, gin.H{
		"preferences":  preferencePayload(prefs),
		"device_count": deviceCount,
		"updated_at":   updatedAt,
	})
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

	currentUser, err := h.authService.GetUser(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		response.NotFound(c, "Không tìm thấy người dùng")
		return
	}

	fullName := strings.TrimSpace(req.FullName)
	if len([]rune(fullName)) < 2 {
		response.BadRequest(c, "HT-VAL-001", "Họ tên phải có ít nhất 2 ký tự")
		return
	}

	email := currentUser.Email
	if req.Email != nil {
		trimmedEmail := strings.TrimSpace(*req.Email)
		if trimmedEmail == "" {
			response.BadRequest(c, "HT-VAL-001", "Email không được để trống")
			return
		}
		email = &trimmedEmail
	}

	bio := currentUser.Bio
	if req.Bio != nil {
		bio = normalizeOptionalText(req.Bio)
	}

	avatarURL := currentUser.AvatarURL
	if req.AvatarURL != nil {
		avatarURL = normalizeOptionalText(req.AvatarURL)
	}

	languages := currentUser.Languages
	if req.Languages != nil {
		languages = normalizeStringSlice(req.Languages)
	}

	user, err := h.authService.UpdateUserProfile(c.Request.Context(), userID.(uuid.UUID), fullName, email, bio, avatarURL, languages)
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

func (h *AuthHandler) UpdatePreferences(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "Chưa xác thực")
		return
	}
	uid := userID.(uuid.UUID)

	var req struct {
		Locale                  string `json:"locale" binding:"required"`
		Currency                string `json:"currency" binding:"required"`
		Region                  string `json:"region"`
		NotificationPreferences struct {
			PushEnabled  bool `json:"push_enabled"`
			EmailEnabled bool `json:"email_enabled"`
			ChatEnabled  bool `json:"chat_enabled"`
			PromoEnabled bool `json:"promo_enabled"`
		} `json:"notification_preferences"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu cài đặt không hợp lệ")
		return
	}

	locale := strings.ToLower(strings.TrimSpace(req.Locale))
	if !isSupportedLocale(locale) {
		response.BadRequest(c, "HT-VAL-001", "Ngôn ngữ không được hỗ trợ")
		return
	}

	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	if !isSupportedCurrency(currency) {
		response.BadRequest(c, "HT-VAL-001", "Đơn vị tiền không được hỗ trợ")
		return
	}

	region := strings.TrimSpace(req.Region)
	if region == "" {
		region = "Hue, Vietnam"
	}

	prefs := &model.UserPreferences{
		UserID:                    uid,
		Locale:                    locale,
		Currency:                  currency,
		Region:                    region,
		PushNotificationsEnabled:  req.NotificationPreferences.PushEnabled,
		EmailNotificationsEnabled: req.NotificationPreferences.EmailEnabled,
		ChatNotificationsEnabled:  req.NotificationPreferences.ChatEnabled,
		PromoNotificationsEnabled: req.NotificationPreferences.PromoEnabled,
	}

	if h.prefRepo == nil {
		response.OK(c, gin.H{
			"preferences":  preferencePayload(prefs),
			"device_count": 1,
			"updated_at":   nil,
			"message":      "Đã cập nhật cài đặt",
		})
		return
	}

	stored, err := h.prefRepo.Upsert(c.Request.Context(), prefs)
	if err != nil {
		response.InternalError(c, "Không thể lưu cài đặt")
		return
	}

	deviceCount, err := h.prefRepo.CountDevices(c.Request.Context(), uid)
	if err != nil {
		deviceCount = 0
	}
	if deviceCount < 1 {
		deviceCount = 1
	}

	response.OK(c, gin.H{
		"preferences":  preferencePayload(stored),
		"device_count": deviceCount,
		"updated_at":   stored.UpdatedAt,
		"message":      "Đã cập nhật cài đặt",
	})
}

func normalizeOptionalText(value *string) *string {
	if value == nil {
		return nil
	}

	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizeStringSlice(values []string) []string {
	if values == nil {
		return nil
	}

	normalized := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

func preferencePayload(prefs *model.UserPreferences) gin.H {
	if prefs == nil {
		return gin.H{
			"locale":   "vi",
			"currency": "VND",
			"region":   "Hue, Vietnam",
			"notification_preferences": gin.H{
				"push_enabled":  true,
				"email_enabled": true,
				"chat_enabled":  true,
				"promo_enabled": false,
			},
		}
	}

	return gin.H{
		"locale":   prefs.Locale,
		"currency": prefs.Currency,
		"region":   prefs.Region,
		"notification_preferences": gin.H{
			"push_enabled":  prefs.PushNotificationsEnabled,
			"email_enabled": prefs.EmailNotificationsEnabled,
			"chat_enabled":  prefs.ChatNotificationsEnabled,
			"promo_enabled": prefs.PromoNotificationsEnabled,
		},
	}
}

func isSupportedLocale(locale string) bool {
	switch locale {
	case "vi", "en", "ja", "ko", "zh", "hi", "th", "id", "ms", "km", "lo", "tl", "my":
		return true
	default:
		return false
	}
}

func isSupportedCurrency(currency string) bool {
	switch currency {
	case "VND", "USD", "EUR":
		return true
	default:
		return false
	}
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
