package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// API Documentation Handler
// Self-documenting API reference
// ============================================

type DocsHandler struct{}

func NewDocsHandler() *DocsHandler {
	return &DocsHandler{}
}

type APIEndpoint struct {
	Method      string `json:"method"`
	Path        string `json:"path"`
	Description string `json:"description"`
	Auth        bool   `json:"auth"`
	Category    string `json:"category"`
}

func (h *DocsHandler) GetDocs(c *gin.Context) {
	endpoints := []APIEndpoint{
		// Health
		{Method: "GET", Path: "/health", Description: "Kiểm tra trạng thái server", Category: "System"},
		{Method: "GET", Path: "/ws", Description: "WebSocket connection", Category: "System"},

		// Auth
		{Method: "POST", Path: "/api/v1/auth/otp/send", Description: "Gửi OTP đến số điện thoại", Category: "Auth"},
		{Method: "POST", Path: "/api/v1/auth/otp/verify", Description: "Xác thực OTP, nhận JWT", Category: "Auth"},
		{Method: "POST", Path: "/api/v1/auth/google", Description: "Đăng nhập bằng Google OAuth", Category: "Auth"},
		{Method: "POST", Path: "/api/v1/auth/refresh", Description: "Làm mới access token", Category: "Auth"},

		// Experiences
		{Method: "GET", Path: "/api/v1/experiences", Description: "Danh sách trải nghiệm", Category: "Experiences"},
		{Method: "GET", Path: "/api/v1/experiences/:id", Description: "Chi tiết trải nghiệm", Category: "Experiences"},
		{Method: "POST", Path: "/api/v1/experiences", Description: "Tạo trải nghiệm mới", Auth: true, Category: "Experiences"},
		{Method: "PUT", Path: "/api/v1/experiences/:id", Description: "Cập nhật trải nghiệm", Auth: true, Category: "Experiences"},

		// Places
		{Method: "GET", Path: "/api/v1/places/search", Description: "Tìm kiếm địa điểm (Google Maps)", Category: "Places"},
		{Method: "GET", Path: "/api/v1/places/nearby", Description: "Địa điểm lân cận", Category: "Places"},
		{Method: "GET", Path: "/api/v1/places/directions", Description: "Lấy chỉ đường", Category: "Places"},

		// AI
		{Method: "POST", Path: "/api/v1/ai/trip-plan", Description: "AI lập kế hoạch chuyến đi", Category: "AI"},
		{Method: "POST", Path: "/api/v1/ai/chat", Description: "Chat với AI assistant", Category: "AI"},
		{Method: "GET", Path: "/api/v1/ai/suggest", Description: "Gợi ý nhanh từ AI", Category: "AI"},

		// Bookings
		{Method: "POST", Path: "/api/v1/bookings", Description: "Tạo booking mới", Auth: true, Category: "Bookings"},
		{Method: "GET", Path: "/api/v1/bookings", Description: "Danh sách bookings", Auth: true, Category: "Bookings"},
		{Method: "GET", Path: "/api/v1/bookings/:id", Description: "Chi tiết booking", Auth: true, Category: "Bookings"},
		{Method: "POST", Path: "/api/v1/bookings/:id/cancel", Description: "Huỷ booking", Auth: true, Category: "Bookings"},

		// Payment
		{Method: "GET", Path: "/api/v1/payment/methods", Description: "Phương thức thanh toán", Category: "Payment"},
		{Method: "POST", Path: "/api/v1/payment/create", Description: "Tạo thanh toán VNPay", Auth: true, Category: "Payment"},
		{Method: "GET", Path: "/api/v1/payment/callback", Description: "VNPay callback", Category: "Payment"},

		// Reviews & Favorites
		{Method: "GET", Path: "/api/v1/experiences/:id/reviews", Description: "Đánh giá của trải nghiệm", Category: "Reviews"},
		{Method: "POST", Path: "/api/v1/reviews", Description: "Viết đánh giá", Auth: true, Category: "Reviews"},
		{Method: "POST", Path: "/api/v1/favorites/toggle/:id", Description: "Toggle yêu thích", Auth: true, Category: "Favorites"},
		{Method: "GET", Path: "/api/v1/favorites", Description: "Danh sách yêu thích", Auth: true, Category: "Favorites"},

		// Guides
		{Method: "GET", Path: "/api/v1/guides/top", Description: "Top hướng dẫn viên", Category: "Guides"},
		{Method: "GET", Path: "/api/v1/guides/:id", Description: "Chi tiết hướng dẫn viên", Category: "Guides"},

		// Chat
		{Method: "GET", Path: "/api/v1/chat/rooms", Description: "Danh sách phòng chat", Auth: true, Category: "Chat"},
		{Method: "POST", Path: "/api/v1/chat/rooms", Description: "Tạo phòng chat", Auth: true, Category: "Chat"},
		{Method: "GET", Path: "/api/v1/chat/rooms/:id/messages", Description: "Tin nhắn trong phòng", Auth: true, Category: "Chat"},
		{Method: "POST", Path: "/api/v1/chat/rooms/:id/messages", Description: "Gửi tin nhắn", Auth: true, Category: "Chat"},
		{Method: "POST", Path: "/api/v1/chat/rooms/:id/read", Description: "Đánh dấu đã đọc", Auth: true, Category: "Chat"},

		// Notifications
		{Method: "GET", Path: "/api/v1/notifications", Description: "Danh sách thông báo", Category: "Notifications"},
		{Method: "GET", Path: "/api/v1/notifications/unread", Description: "Số thông báo chưa đọc", Category: "Notifications"},
		{Method: "POST", Path: "/api/v1/notifications/:id/read", Description: "Đánh dấu đã đọc", Category: "Notifications"},
		{Method: "POST", Path: "/api/v1/notifications/device", Description: "Đăng ký FCM token", Category: "Notifications"},

		// Admin
		{Method: "GET", Path: "/api/v1/admin/dashboard", Description: "Dashboard stats", Auth: true, Category: "Admin"},
		{Method: "GET", Path: "/api/v1/admin/health", Description: "System health check", Auth: true, Category: "Admin"},
		{Method: "GET", Path: "/api/v1/admin/quick-stats", Description: "Quick stats", Auth: true, Category: "Admin"},

		// Search
		{Method: "GET", Path: "/api/v1/search", Description: "Full-text search", Category: "Search"},
		{Method: "GET", Path: "/api/v1/search/suggest", Description: "Gợi ý tìm kiếm", Category: "Search"},
		{Method: "GET", Path: "/api/v1/search/trending", Description: "Tìm kiếm phổ biến", Category: "Search"},
		{Method: "GET", Path: "/api/v1/search/stats", Description: "Search index stats", Category: "Search"},

		// Profile
		{Method: "GET", Path: "/api/v1/me", Description: "Thông tin user hiện tại", Auth: true, Category: "Profile"},

		// Docs
		{Method: "GET", Path: "/api/v1/docs", Description: "API documentation (trang này)", Category: "System"},
	}

	// Group by category
	categories := make(map[string][]APIEndpoint)
	for _, ep := range endpoints {
		categories[ep.Category] = append(categories[ep.Category], ep)
	}

	response.OK(c, gin.H{
		"title":       "Huế Travel API Documentation",
		"version":     "1.0.0",
		"base_url":    "http://localhost:8080",
		"total":       len(endpoints),
		"categories":  categories,
		"endpoints":   endpoints,
		"auth_header": "Authorization: Bearer <token>",
		"content_type": "application/json",
	})
}
