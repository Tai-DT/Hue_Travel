package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Blog Handler
// ============================================

type BlogHandler struct {
	blogRepo *repository.BlogRepository
}

func NewBlogHandler(blogRepo *repository.BlogRepository) *BlogHandler {
	return &BlogHandler{blogRepo: blogRepo}
}

func (h *BlogHandler) Create(c *gin.Context) {
	var post repository.BlogPost
	if err := c.ShouldBindJSON(&post); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ")
		return
	}
	userID, _ := c.Get("user_id")
	post.AuthorID = userID.(uuid.UUID)
	post.IsPublished = true
	if err := h.blogRepo.Create(c.Request.Context(), &post); err != nil {
		response.InternalError(c, "Không thể tạo bài viết")
		return
	}
	response.Created(c, gin.H{"post": post})
}

func (h *BlogHandler) List(c *gin.Context) {
	category := c.Query("category")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "10"))
	posts, total, err := h.blogRepo.ListPublished(c.Request.Context(), category, page, perPage)
	if err != nil {
		response.InternalError(c, "Không thể tải bài viết")
		return
	}
	if posts == nil { posts = []repository.BlogPost{} }
	response.OK(c, gin.H{"posts": posts, "total": total, "page": page})
}

func (h *BlogHandler) GetBySlug(c *gin.Context) {
	post, err := h.blogRepo.GetBySlug(c.Request.Context(), c.Param("slug"))
	if err != nil {
		response.NotFound(c, "Bài viết không tồn tại")
		return
	}
	response.OK(c, gin.H{"post": post})
}

func (h *BlogHandler) Trending(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	posts, err := h.blogRepo.GetTrending(c.Request.Context(), limit)
	if err != nil {
		response.InternalError(c, "Không thể tải trending")
		return
	}
	if posts == nil { posts = []repository.BlogPost{} }
	response.OK(c, gin.H{"posts": posts, "total": len(posts)})
}

func (h *BlogHandler) ToggleLike(c *gin.Context) {
	blogID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}
	userID, _ := c.Get("user_id")
	liked, _ := h.blogRepo.ToggleLike(c.Request.Context(), blogID, userID.(uuid.UUID))
	action := "unliked"
	if liked { action = "liked" }
	response.OK(c, gin.H{"action": action})
}

func (h *BlogHandler) AddComment(c *gin.Context) {
	blogID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}
	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu nội dung")
		return
	}
	userID, _ := c.Get("user_id")
	comment, err := h.blogRepo.AddComment(c.Request.Context(), blogID, userID.(uuid.UUID), req.Content)
	if err != nil {
		response.InternalError(c, "Không thể bình luận")
		return
	}
	response.Created(c, gin.H{"comment": comment})
}

func (h *BlogHandler) ListComments(c *gin.Context) {
	blogID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}
	comments, err := h.blogRepo.ListComments(c.Request.Context(), blogID)
	if err != nil {
		response.InternalError(c, "Không thể tải bình luận")
		return
	}
	if comments == nil { comments = []repository.BlogComment{} }
	response.OK(c, gin.H{"comments": comments, "total": len(comments)})
}

// ============================================
// Diary Handler
// ============================================

type DiaryHandler struct {
	diaryRepo *repository.DiaryRepository
}

func NewDiaryHandler(diaryRepo *repository.DiaryRepository) *DiaryHandler {
	return &DiaryHandler{diaryRepo: diaryRepo}
}

func (h *DiaryHandler) Create(c *gin.Context) {
	var entry repository.DiaryEntry
	if err := c.ShouldBindJSON(&entry); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ")
		return
	}
	userID, _ := c.Get("user_id")
	entry.UserID = userID.(uuid.UUID)
	if err := h.diaryRepo.Create(c.Request.Context(), &entry); err != nil {
		response.InternalError(c, "Không thể tạo nhật ký")
		return
	}
	response.Created(c, gin.H{"entry": entry})
}

func (h *DiaryHandler) ListMine(c *gin.Context) {
	userID, _ := c.Get("user_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	entries, err := h.diaryRepo.ListByUser(c.Request.Context(), userID.(uuid.UUID), limit)
	if err != nil {
		response.InternalError(c, "Không thể tải nhật ký")
		return
	}
	if entries == nil { entries = []repository.DiaryEntry{} }
	response.OK(c, gin.H{"entries": entries, "total": len(entries)})
}

func (h *DiaryHandler) ListPublic(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	entries, err := h.diaryRepo.ListPublic(c.Request.Context(), limit)
	if err != nil {
		response.InternalError(c, "Không thể tải")
		return
	}
	if entries == nil { entries = []repository.DiaryEntry{} }
	response.OK(c, gin.H{"entries": entries, "total": len(entries)})
}

// ============================================
// Event Handler
// ============================================

type EventHandler struct {
	eventRepo *repository.EventRepository
}

func NewEventHandler(eventRepo *repository.EventRepository) *EventHandler {
	return &EventHandler{eventRepo: eventRepo}
}

func (h *EventHandler) ListUpcoming(c *gin.Context) {
	category := c.Query("category")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	events, err := h.eventRepo.ListUpcoming(c.Request.Context(), category, limit)
	if err != nil {
		response.InternalError(c, "Không thể tải sự kiện")
		return
	}
	if events == nil { events = []repository.LocalEvent{} }
	response.OK(c, gin.H{"events": events, "total": len(events)})
}

func (h *EventHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}
	event, err := h.eventRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Sự kiện không tồn tại")
		return
	}
	response.OK(c, gin.H{"event": event})
}

func (h *EventHandler) RSVP(c *gin.Context) {
	eventID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}
	var req struct {
		Status string `json:"status"` // going, interested, not_going
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Status == "" {
		req.Status = "going"
	}
	userID, _ := c.Get("user_id")
	if err := h.eventRepo.RSVP(c.Request.Context(), eventID, userID.(uuid.UUID), req.Status); err != nil {
		response.InternalError(c, "Không thể RSVP")
		return
	}
	response.OK(c, gin.H{"message": "RSVP thành công", "status": req.Status})
}

// ============================================
// SOS Handler
// ============================================

type SOSHandler struct {
	sosRepo *repository.SOSRepository
}

func NewSOSHandler(sosRepo *repository.SOSRepository) *SOSHandler {
	return &SOSHandler{sosRepo: sosRepo}
}

type EmergencyContact struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Type    string `json:"type"`
}

func (h *SOSHandler) SendSOS(c *gin.Context) {
	var alert repository.SOSAlert
	if err := c.ShouldBindJSON(&alert); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu vị trí GPS")
		return
	}
	if alert.AlertType == "" { alert.AlertType = "emergency" }
	userID, _ := c.Get("user_id")
	alert.UserID = userID.(uuid.UUID)
	if err := h.sosRepo.CreateAlert(c.Request.Context(), &alert); err != nil {
		response.InternalError(c, "Không thể gửi SOS")
		return
	}
	response.Created(c, gin.H{
		"alert":   alert,
		"message": "🆘 SOS đã được gửi! Giữ bình tĩnh, trợ giúp đang đến.",
	})
}

func (h *SOSHandler) CancelSOS(c *gin.Context) {
	alertID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}
	userID, _ := c.Get("user_id")
	h.sosRepo.CancelAlert(c.Request.Context(), alertID, userID.(uuid.UUID))
	response.OK(c, gin.H{"message": "Đã hủy SOS"})
}

func (h *SOSHandler) GetContacts(c *gin.Context) {
	contacts := []EmergencyContact{
		{Name: "Cấp cứu", Phone: "115", Type: "medical"},
		{Name: "Công an", Phone: "113", Type: "police"},
		{Name: "Cứu hỏa", Phone: "114", Type: "fire"},
		{Name: "BV Trung ương Huế", Phone: "0234-3822-325", Type: "hospital"},
		{Name: "BV Quốc tế Huế", Phone: "0234-3899-899", Type: "hospital"},
		{Name: "Công an TP Huế", Phone: "0234-3821-500", Type: "police"},
		{Name: "Đại sứ quán Mỹ", Phone: "024-3850-5000", Type: "embassy"},
		{Name: "Đại sứ quán Hàn Quốc", Phone: "024-3831-5110", Type: "embassy"},
		{Name: "Đại sứ quán Nhật Bản", Phone: "024-3846-3000", Type: "embassy"},
		{Name: "Hotline du lịch", Phone: "1900-6767", Type: "tourism"},
	}
	response.OK(c, gin.H{"contacts": contacts, "total": len(contacts)})
}

func (h *SOSHandler) GetNearbyHospitals(c *gin.Context) {
	hospitals := []gin.H{
		{"name": "Bệnh viện Trung ương Huế", "address": "16 Lê Lợi, Huế", "phone": "0234-3822-325", "lat": 16.4612, "lng": 107.5847},
		{"name": "Bệnh viện Quốc tế Huế", "address": "12 Nguyễn Huệ, Huế", "phone": "0234-3899-899", "lat": 16.4635, "lng": 107.5920},
		{"name": "Bệnh viện Đại học Y Dược Huế", "address": "6 Ngô Quyền, Huế", "phone": "0234-3826-269", "lat": 16.4650, "lng": 107.5870},
		{"name": "Phòng khám Hoàn Mỹ", "address": "55 Nguyễn Huệ, Huế", "phone": "0234-3823-456", "lat": 16.4620, "lng": 107.5910},
	}
	response.OK(c, gin.H{"hospitals": hospitals, "total": len(hospitals)})
}

// ============================================
// Translation Handler (dùng Gemini)
// ============================================

type TranslationHandler struct{}

func NewTranslationHandler() *TranslationHandler {
	return &TranslationHandler{}
}

func (h *TranslationHandler) GetPhrasebook(c *gin.Context) {
	phrases := []gin.H{
		{"vi": "Xin chào", "en": "Hello", "ko": "안녕하세요", "ja": "こんにちは", "zh": "你好", "category": "greeting"},
		{"vi": "Cảm ơn", "en": "Thank you", "ko": "감사합니다", "ja": "ありがとう", "zh": "谢谢", "category": "greeting"},
		{"vi": "Bao nhiêu tiền?", "en": "How much?", "ko": "얼마예요?", "ja": "いくらですか？", "zh": "多少钱？", "category": "shopping"},
		{"vi": "Quá đắt", "en": "Too expensive", "ko": "너무 비싸요", "ja": "高すぎます", "zh": "太贵了", "category": "shopping"},
		{"vi": "Giảm giá được không?", "en": "Discount please?", "ko": "할인해 주세요", "ja": "割引できますか？", "zh": "可以便宜吗？", "category": "shopping"},
		{"vi": "Nhà vệ sinh ở đâu?", "en": "Where is the restroom?", "ko": "화장실 어디예요?", "ja": "トイレはどこですか？", "zh": "厕所在哪里？", "category": "travel"},
		{"vi": "Đi đến ... bằng cách nào?", "en": "How to get to...?", "ko": "...에 어떻게 가요?", "ja": "...へはどうやって行きますか？", "zh": "怎么去...？", "category": "travel"},
		{"vi": "Gọi cấp cứu giúp tôi!", "en": "Call an ambulance!", "ko": "구급차를 불러주세요!", "ja": "救急車を呼んでください！", "zh": "请叫救护车！", "category": "emergency"},
		{"vi": "Tôi bị lạc đường", "en": "I'm lost", "ko": "길을 잃었어요", "ja": "道に迷いました", "zh": "我迷路了", "category": "emergency"},
		{"vi": "Cho tôi xem menu", "en": "Menu please", "ko": "메뉴 주세요", "ja": "メニューください", "zh": "请给我菜单", "category": "food"},
		{"vi": "Ngon lắm!", "en": "Delicious!", "ko": "맛있어요!", "ja": "おいしい！", "zh": "好吃！", "category": "food"},
		{"vi": "Tôi dị ứng với...", "en": "I'm allergic to...", "ko": "...에 알레르기가 있어요", "ja": "...アレルギーがあります", "zh": "我对...过敏", "category": "food"},
		{"vi": "Bún bò Huế", "en": "Hue beef noodle soup", "ko": "후에 소고기 국수", "ja": "フエ牛肉麺", "zh": "顺化牛肉粉", "category": "food"},
		{"vi": "Đại Nội", "en": "Imperial Citadel", "ko": "후에 황궁", "ja": "フエ王宮", "zh": "顺化皇城", "category": "sightseeing"},
		{"vi": "Sông Hương", "en": "Perfume River", "ko": "향강", "ja": "フォン川", "zh": "香江", "category": "sightseeing"},
	}

	cat := c.Query("category")
	if cat != "" {
		var filtered []gin.H
		for _, p := range phrases {
			if p["category"] == cat {
				filtered = append(filtered, p)
			}
		}
		phrases = filtered
	}

	response.OK(c, gin.H{
		"phrases":    phrases,
		"total":      len(phrases),
		"languages":  []string{"vi", "en", "ko", "ja", "zh"},
		"categories": []string{"greeting", "shopping", "travel", "emergency", "food", "sightseeing"},
	})
}
