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
		{Method: "POST", Path: "/api/v1/auth/register", Description: "Đăng ký tài khoản bằng email + mật khẩu", Category: "Auth"},
		{Method: "POST", Path: "/api/v1/auth/login", Description: "Đăng nhập bằng email + mật khẩu", Category: "Auth"},
		{Method: "POST", Path: "/api/v1/auth/refresh", Description: "Làm mới access token", Category: "Auth"},
		{Method: "POST", Path: "/api/v1/auth/password", Description: "Đặt hoặc đổi mật khẩu cho tài khoản hiện tại", Auth: true, Category: "Auth"},

		// Experiences
		{Method: "GET", Path: "/api/v1/experiences", Description: "Danh sách trải nghiệm", Category: "Experiences"},
		{Method: "GET", Path: "/api/v1/experiences/:id", Description: "Chi tiết trải nghiệm", Category: "Experiences"},
		{Method: "POST", Path: "/api/v1/experiences", Description: "Tạo trải nghiệm mới", Auth: true, Category: "Experiences"},
		{Method: "PUT", Path: "/api/v1/experiences/:id", Description: "Cập nhật trải nghiệm", Auth: true, Category: "Experiences"},

		// Places
		{Method: "GET", Path: "/api/v1/places/search", Description: "Tìm kiếm địa điểm (Goong Maps)", Category: "Places"},
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
		{Method: "GET", Path: "/api/v1/notifications", Description: "Danh sách thông báo", Auth: true, Category: "Notifications"},
		{Method: "GET", Path: "/api/v1/notifications/unread", Description: "Số thông báo chưa đọc", Auth: true, Category: "Notifications"},
		{Method: "POST", Path: "/api/v1/notifications/:id/read", Description: "Đánh dấu đã đọc", Auth: true, Category: "Notifications"},
		{Method: "POST", Path: "/api/v1/notifications/device", Description: "Đăng ký FCM token", Auth: true, Category: "Notifications"},

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

		// Friends
		{Method: "POST", Path: "/api/v1/friends/request", Description: "Gửi lời kết bạn", Auth: true, Category: "Friends"},
		{Method: "POST", Path: "/api/v1/friends/:id/accept", Description: "Chấp nhận lời kết bạn", Auth: true, Category: "Friends"},
		{Method: "POST", Path: "/api/v1/friends/:id/decline", Description: "Từ chối lời kết bạn", Auth: true, Category: "Friends"},
		{Method: "DELETE", Path: "/api/v1/friends/:id", Description: "Hủy kết bạn", Auth: true, Category: "Friends"},
		{Method: "GET", Path: "/api/v1/friends", Description: "Danh sách bạn bè", Auth: true, Category: "Friends"},
		{Method: "GET", Path: "/api/v1/friends/pending", Description: "Lời mời đang chờ", Auth: true, Category: "Friends"},
		{Method: "GET", Path: "/api/v1/friends/status/:id", Description: "Kiểm tra trạng thái kết bạn", Auth: true, Category: "Friends"},

		// Trips
		{Method: "POST", Path: "/api/v1/trips", Description: "Tạo chuyến đi", Auth: true, Category: "Trips"},
		{Method: "GET", Path: "/api/v1/trips", Description: "Chuyến đi của tôi", Auth: true, Category: "Trips"},
		{Method: "GET", Path: "/api/v1/trips/discover", Description: "Tìm chuyến đi công khai", Category: "Trips"},
		{Method: "GET", Path: "/api/v1/trips/invitations", Description: "Lời mời chuyến đi", Auth: true, Category: "Trips"},
		{Method: "GET", Path: "/api/v1/trips/:id", Description: "Chi tiết chuyến đi", Auth: true, Category: "Trips"},
		{Method: "POST", Path: "/api/v1/trips/:id/invite", Description: "Mời bạn tham gia", Auth: true, Category: "Trips"},
		{Method: "POST", Path: "/api/v1/trips/:id/invite-guide", Description: "Mời hướng dẫn viên", Auth: true, Category: "Trips"},
		{Method: "POST", Path: "/api/v1/trips/:id/accept", Description: "Chấp nhận lời mời trip", Auth: true, Category: "Trips"},
		{Method: "POST", Path: "/api/v1/trips/:id/decline", Description: "Từ chối lời mời trip", Auth: true, Category: "Trips"},
		{Method: "POST", Path: "/api/v1/trips/:id/join", Description: "Tham gia trip công khai", Auth: true, Category: "Trips"},
		{Method: "POST", Path: "/api/v1/trips/:id/leave", Description: "Rời chuyến đi", Auth: true, Category: "Trips"},
		{Method: "GET", Path: "/api/v1/trips/:id/guides", Description: "Tìm guide cho chuyến đi", Auth: true, Category: "Trips"},

		// Reactions
		{Method: "POST", Path: "/api/v1/messages/:id/reactions", Description: "Thả/gỡ emoji reaction", Auth: true, Category: "Reactions"},
		{Method: "GET", Path: "/api/v1/messages/:id/reactions", Description: "Danh sách reactions", Auth: true, Category: "Reactions"},

		// Weather
		{Method: "GET", Path: "/api/v1/weather/current", Description: "Thời tiết Huế hiện tại", Category: "Weather"},
		{Method: "GET", Path: "/api/v1/weather/forecast", Description: "Dự báo 7 ngày", Category: "Weather"},
		{Method: "GET", Path: "/api/v1/weather/best-time", Description: "Thời điểm tốt nhất để du lịch", Category: "Weather"},

		// Promotions
		{Method: "POST", Path: "/api/v1/promotions", Description: "Tạo khuyến mãi", Auth: true, Category: "Promotions"},
		{Method: "GET", Path: "/api/v1/promotions/active", Description: "Khuyến mãi đang có", Category: "Promotions"},
		{Method: "POST", Path: "/api/v1/promotions/apply", Description: "Áp dụng mã giảm giá", Auth: true, Category: "Promotions"},
		{Method: "GET", Path: "/api/v1/promotions/my-coupons", Description: "Coupon khả dụng", Auth: true, Category: "Promotions"},

		// Gamification
		{Method: "GET", Path: "/api/v1/achievements", Description: "Danh sách thành tựu", Category: "Gamification"},
		{Method: "GET", Path: "/api/v1/achievements/my", Description: "Thành tựu đã đạt", Auth: true, Category: "Gamification"},
		{Method: "GET", Path: "/api/v1/leaderboard", Description: "Bảng xếp hạng", Category: "Gamification"},
		{Method: "POST", Path: "/api/v1/checkin", Description: "Check-in địa điểm (+XP)", Auth: true, Category: "Gamification"},
		{Method: "GET", Path: "/api/v1/checkins", Description: "Lịch sử check-in", Auth: true, Category: "Gamification"},
		{Method: "GET", Path: "/api/v1/gamification/stats", Description: "Thống kê XP/Level cá nhân", Auth: true, Category: "Gamification"},

		// Blog
		{Method: "GET", Path: "/api/v1/blog/posts", Description: "Danh sách bài viết", Category: "Blog"},
		{Method: "GET", Path: "/api/v1/blog/posts/:slug", Description: "Chi tiết bài viết", Category: "Blog"},
		{Method: "GET", Path: "/api/v1/blog/trending", Description: "Bài viết trending", Category: "Blog"},
		{Method: "POST", Path: "/api/v1/blog/posts", Description: "Viết bài mới", Auth: true, Category: "Blog"},
		{Method: "POST", Path: "/api/v1/blog/posts/:id/like", Description: "Like/Unlike bài", Auth: true, Category: "Blog"},
		{Method: "POST", Path: "/api/v1/blog/posts/:id/comments", Description: "Bình luận", Auth: true, Category: "Blog"},
		{Method: "GET", Path: "/api/v1/blog/posts/:id/comments", Description: "Danh sách bình luận", Category: "Blog"},

		// Diary
		{Method: "POST", Path: "/api/v1/diary/entries", Description: "Tạo nhật ký", Auth: true, Category: "Diary"},
		{Method: "GET", Path: "/api/v1/diary/entries", Description: "Nhật ký của tôi", Auth: true, Category: "Diary"},
		{Method: "GET", Path: "/api/v1/diary/public", Description: "Nhật ký công khai", Category: "Diary"},

		// Events
		{Method: "GET", Path: "/api/v1/events", Description: "Sự kiện sắp tới", Category: "Events"},
		{Method: "GET", Path: "/api/v1/events/:id", Description: "Chi tiết sự kiện", Category: "Events"},
		{Method: "POST", Path: "/api/v1/events/:id/rsvp", Description: "Đăng ký tham gia", Auth: true, Category: "Events"},

		// Emergency SOS
		{Method: "POST", Path: "/api/v1/emergency/sos", Description: "🆘 Gửi SOS khẩn cấp", Auth: true, Category: "Emergency"},
		{Method: "POST", Path: "/api/v1/emergency/sos/:id/cancel", Description: "Hủy SOS", Auth: true, Category: "Emergency"},
		{Method: "GET", Path: "/api/v1/emergency/contacts", Description: "Số điện thoại khẩn cấp", Category: "Emergency"},
		{Method: "GET", Path: "/api/v1/emergency/hospitals", Description: "Bệnh viện gần nhất", Category: "Emergency"},

		// Translation
		{Method: "GET", Path: "/api/v1/phrasebook", Description: "Sổ tay câu thường dùng (5 ngôn ngữ)", Category: "Translation"},

		// Profile (extended)
		{Method: "PUT", Path: "/api/v1/me", Description: "Cập nhật thông tin cá nhân", Auth: true, Category: "Profile"},
		{Method: "DELETE", Path: "/api/v1/me", Description: "Xóa tài khoản", Auth: true, Category: "Profile"},
		{Method: "POST", Path: "/api/v1/auth/logout", Description: "Đăng xuất", Auth: true, Category: "Auth"},

		// Experience Management (Guide/Admin)
		{Method: "POST", Path: "/api/v1/experiences", Description: "Tạo trải nghiệm mới (guide/admin)", Auth: true, Category: "Experiences"},
		{Method: "PUT", Path: "/api/v1/experiences/:id", Description: "Cập nhật trải nghiệm", Auth: true, Category: "Experiences"},
		{Method: "DELETE", Path: "/api/v1/experiences/:id", Description: "Xóa trải nghiệm", Auth: true, Category: "Experiences"},

		// Booking (Guide actions)
		{Method: "POST", Path: "/api/v1/bookings/:id/confirm", Description: "Guide xác nhận booking", Auth: true, Category: "Bookings"},
		{Method: "POST", Path: "/api/v1/bookings/:id/complete", Description: "Guide hoàn thành booking", Auth: true, Category: "Bookings"},
		{Method: "GET", Path: "/api/v1/bookings/guide/me", Description: "Booking dành cho guide", Auth: true, Category: "Bookings"},

		// Guide Profile
		{Method: "PUT", Path: "/api/v1/guides/me/profile", Description: "Guide cập nhật profile", Auth: true, Category: "Guides"},

		// Upload
		{Method: "POST", Path: "/api/v1/upload", Description: "Upload file (ảnh/video)", Auth: true, Category: "Upload"},
		{Method: "POST", Path: "/api/v1/upload/avatar", Description: "Upload avatar", Auth: true, Category: "Upload"},

		// Admin Management
		{Method: "GET", Path: "/api/v1/admin/users", Description: "Danh sách users", Auth: true, Category: "Admin"},
		{Method: "GET", Path: "/api/v1/admin/users/:id", Description: "Chi tiết user", Auth: true, Category: "Admin"},
		{Method: "PUT", Path: "/api/v1/admin/users/:id/status", Description: "Ban/Unban user", Auth: true, Category: "Admin"},
		{Method: "PUT", Path: "/api/v1/admin/users/:id/role", Description: "Thay đổi role", Auth: true, Category: "Admin"},
		{Method: "GET", Path: "/api/v1/admin/experiences", Description: "Quản lý trải nghiệm", Auth: true, Category: "Admin"},
		{Method: "DELETE", Path: "/api/v1/admin/experiences/:id", Description: "Xóa trải nghiệm", Auth: true, Category: "Admin"},
		{Method: "GET", Path: "/api/v1/admin/reviews", Description: "Quản lý đánh giá", Auth: true, Category: "Admin"},
		{Method: "PUT", Path: "/api/v1/admin/reviews/:id/featured", Description: "Đánh dấu nổi bật", Auth: true, Category: "Admin"},
		{Method: "DELETE", Path: "/api/v1/admin/reviews/:id", Description: "Xóa đánh giá", Auth: true, Category: "Admin"},
		{Method: "GET", Path: "/api/v1/admin/bookings", Description: "Quản lý booking", Auth: true, Category: "Admin"},
		{Method: "PUT", Path: "/api/v1/admin/bookings/:id/status", Description: "Cập nhật status booking", Auth: true, Category: "Admin"},

		// Report & Block
		{Method: "POST", Path: "/api/v1/reports", Description: "Báo cáo nội dung vi phạm", Auth: true, Category: "Report & Block"},
		{Method: "POST", Path: "/api/v1/block", Description: "Block user", Auth: true, Category: "Report & Block"},
		{Method: "DELETE", Path: "/api/v1/block/:id", Description: "Unblock user", Auth: true, Category: "Report & Block"},
		{Method: "GET", Path: "/api/v1/block", Description: "Danh sách đã block", Auth: true, Category: "Report & Block"},

		// Guide Application
		{Method: "POST", Path: "/api/v1/guide-apply", Description: "Đăng ký trở thành guide", Auth: true, Category: "Guide Registration"},
		{Method: "GET", Path: "/api/v1/guide-apply/my", Description: "Xem trạng thái đơn đăng ký", Auth: true, Category: "Guide Registration"},

		// Stories / Travel Feed
		{Method: "POST", Path: "/api/v1/feed", Description: "Đăng story mới", Auth: true, Category: "Feed"},
		{Method: "GET", Path: "/api/v1/feed", Description: "Xem travel feed", Auth: true, Category: "Feed"},
		{Method: "POST", Path: "/api/v1/feed/:id/like", Description: "Like/Unlike story", Auth: true, Category: "Feed"},
		{Method: "POST", Path: "/api/v1/feed/:id/comment", Description: "Bình luận story", Auth: true, Category: "Feed"},
		{Method: "GET", Path: "/api/v1/feed/:id/comments", Description: "Danh sách bình luận", Auth: true, Category: "Feed"},
		{Method: "DELETE", Path: "/api/v1/feed/:id", Description: "Xóa story", Auth: true, Category: "Feed"},

		// AI Translation
		{Method: "POST", Path: "/api/v1/translate", Description: "Dịch văn bản real-time", Category: "Translation"},
		{Method: "POST", Path: "/api/v1/translate/detect", Description: "Nhận diện ngôn ngữ", Category: "Translation"},

		// Collections (Bookmarks)
		{Method: "POST", Path: "/api/v1/collections", Description: "Tạo bộ sưu tập", Auth: true, Category: "Collections"},
		{Method: "GET", Path: "/api/v1/collections", Description: "Bộ sưu tập của tôi", Auth: true, Category: "Collections"},
		{Method: "POST", Path: "/api/v1/collections/:id/items", Description: "Thêm vào bộ sưu tập", Auth: true, Category: "Collections"},
		{Method: "GET", Path: "/api/v1/collections/:id/items", Description: "Xem items trong collection", Auth: true, Category: "Collections"},
		{Method: "DELETE", Path: "/api/v1/collections/:id/items/:item_id", Description: "Xóa khỏi collection", Auth: true, Category: "Collections"},
		{Method: "DELETE", Path: "/api/v1/collections/:id", Description: "Xóa bộ sưu tập", Auth: true, Category: "Collections"},
	}

	// Group by category
	categories := make(map[string][]APIEndpoint)
	for _, ep := range endpoints {
		categories[ep.Category] = append(categories[ep.Category], ep)
	}

	response.OK(c, gin.H{
		"title":        "Huế Travel API Documentation",
		"version":      "1.0.0",
		"base_url":     "http://localhost:8080",
		"total":        len(endpoints),
		"categories":   categories,
		"endpoints":    endpoints,
		"auth_header":  "Authorization: Bearer <token>",
		"content_type": "application/json",
	})
}
