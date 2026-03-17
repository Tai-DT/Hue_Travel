package handler

import (
	"fmt"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// 1. Report & Block Handler
// ============================================

type ReportBlockHandler struct {
	repo *repository.ReportBlockRepository
}

func NewReportBlockHandler(repo *repository.ReportBlockRepository) *ReportBlockHandler {
	return &ReportBlockHandler{repo: repo}
}

func (h *ReportBlockHandler) CreateReport(c *gin.Context) {
	var req struct {
		TargetType  string  `json:"target_type" binding:"required"`
		TargetID    string  `json:"target_id" binding:"required"`
		Reason      string  `json:"reason" binding:"required"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ")
		return
	}
	userID, _ := c.Get("user_id")
	targetID, err := uuid.Parse(req.TargetID)
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "target_id không hợp lệ")
		return
	}
	report := &repository.Report{
		ReporterID:  userID.(uuid.UUID),
		TargetType:  req.TargetType,
		TargetID:    targetID,
		Reason:      req.Reason,
		Description: req.Description,
	}
	if err := h.repo.CreateReport(c.Request.Context(), report); err != nil {
		response.InternalError(c, "Không thể gửi báo cáo")
		return
	}
	response.Created(c, gin.H{"report": report})
}

func (h *ReportBlockHandler) ListReports(c *gin.Context) {
	status := c.Query("status")
	reports, err := h.repo.ListReports(c.Request.Context(), status)
	if err != nil {
		response.InternalError(c, "Không thể tải báo cáo")
		return
	}
	if reports == nil {
		reports = []repository.Report{}
	}
	response.OK(c, gin.H{"reports": reports, "total": len(reports)})
}

func (h *ReportBlockHandler) BlockUser(c *gin.Context) {
	var req struct {
		UserID string `json:"user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu user_id")
		return
	}
	userID, _ := c.Get("user_id")
	blockedID, err := uuid.Parse(req.UserID)
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "user_id không hợp lệ")
		return
	}
	if userID.(uuid.UUID) == blockedID {
		response.BadRequest(c, "HT-BLK-001", "Không thể block chính mình")
		return
	}
	if err := h.repo.BlockUser(c.Request.Context(), userID.(uuid.UUID), blockedID); err != nil {
		response.InternalError(c, "Không thể block user")
		return
	}
	response.OK(c, gin.H{"message": "Đã block user"})
}

func (h *ReportBlockHandler) UnblockUser(c *gin.Context) {
	userID, _ := c.Get("user_id")
	blockedID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}
	if err := h.repo.UnblockUser(c.Request.Context(), userID.(uuid.UUID), blockedID); err != nil {
		response.InternalError(c, "Không thể unblock")
		return
	}
	response.OK(c, gin.H{"message": "Đã unblock user"})
}

func (h *ReportBlockHandler) ListBlocked(c *gin.Context) {
	userID, _ := c.Get("user_id")
	blocked, err := h.repo.ListBlocked(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể tải danh sách")
		return
	}
	if blocked == nil {
		blocked = []repository.BlockedUser{}
	}
	response.OK(c, gin.H{"blocked_users": blocked, "total": len(blocked)})
}

// ============================================
// 2. Guide Application Handler
// ============================================

type GuideAppHandler struct {
	repo *repository.GuideAppRepository
}

func NewGuideAppHandler(repo *repository.GuideAppRepository) *GuideAppHandler {
	return &GuideAppHandler{repo: repo}
}

func (h *GuideAppHandler) Apply(c *gin.Context) {
	var app repository.GuideApplication
	if err := c.ShouldBindJSON(&app); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ")
		return
	}
	userID, _ := c.Get("user_id")
	app.UserID = userID.(uuid.UUID)

	if app.FullName == "" {
		response.BadRequest(c, "HT-VAL-001", "Thiếu họ tên")
		return
	}

	if err := h.repo.Create(c.Request.Context(), &app); err != nil {
		response.InternalError(c, "Không thể gửi đơn: "+err.Error())
		return
	}
	response.Created(c, gin.H{"application": app, "message": "Đơn đăng ký đã được gửi, chờ duyệt"})
}

func (h *GuideAppHandler) MyApplication(c *gin.Context) {
	userID, _ := c.Get("user_id")
	app, err := h.repo.GetMyApplication(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		response.OK(c, gin.H{"application": nil, "message": "Chưa có đơn đăng ký"})
		return
	}
	response.OK(c, gin.H{"application": app})
}

func (h *GuideAppHandler) ListPending(c *gin.Context) {
	apps, err := h.repo.ListPending(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Không thể tải đơn")
		return
	}
	if apps == nil {
		apps = []repository.GuideApplication{}
	}
	response.OK(c, gin.H{"applications": apps, "total": len(apps)})
}

func (h *GuideAppHandler) Approve(c *gin.Context) {
	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}
	var req struct {
		Note string `json:"note"`
	}
	c.ShouldBindJSON(&req)
	if err := h.repo.Approve(c.Request.Context(), appID, req.Note); err != nil {
		response.InternalError(c, "Không thể duyệt")
		return
	}
	response.OK(c, gin.H{"message": "Đã duyệt đơn đăng ký guide"})
}

func (h *GuideAppHandler) Reject(c *gin.Context) {
	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "ID không hợp lệ")
		return
	}
	var req struct {
		Note string `json:"note"`
	}
	c.ShouldBindJSON(&req)
	if err := h.repo.Reject(c.Request.Context(), appID, req.Note); err != nil {
		response.InternalError(c, "Không thể từ chối")
		return
	}
	response.OK(c, gin.H{"message": "Đã từ chối đơn đăng ký guide"})
}

// ============================================
// 3. Stories / Travel Feed Handler
// ============================================

type StoryHandler struct {
	repo *repository.StoryRepository
}

func NewStoryHandler(repo *repository.StoryRepository) *StoryHandler {
	return &StoryHandler{repo: repo}
}

func (h *StoryHandler) Create(c *gin.Context) {
	var story repository.Story
	if err := c.ShouldBindJSON(&story); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ")
		return
	}
	userID, _ := c.Get("user_id")
	story.AuthorID = userID.(uuid.UUID)

	if err := h.repo.Create(c.Request.Context(), &story); err != nil {
		response.InternalError(c, "Không thể đăng story")
		return
	}
	response.Created(c, gin.H{"story": story})
}

func (h *StoryHandler) Feed(c *gin.Context) {
	var userID uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		userID = uid.(uuid.UUID)
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	stories, err := h.repo.Feed(c.Request.Context(), userID, limit, offset)
	if err != nil {
		response.InternalError(c, "Không thể tải feed")
		return
	}
	if stories == nil {
		stories = []repository.Story{}
	}
	response.OK(c, gin.H{"stories": stories, "total": len(stories)})
}

func (h *StoryHandler) Like(c *gin.Context) {
	userID, _ := c.Get("user_id")
	storyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Story ID không hợp lệ")
		return
	}
	liked, err := h.repo.ToggleLike(c.Request.Context(), storyID, userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Lỗi")
		return
	}
	msg := "Đã like"
	if !liked {
		msg = "Đã unlike"
	}
	response.OK(c, gin.H{"liked": liked, "message": msg})
}

func (h *StoryHandler) Comment(c *gin.Context) {
	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu nội dung")
		return
	}
	userID, _ := c.Get("user_id")
	storyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Story ID không hợp lệ")
		return
	}
	comment := &repository.StoryComment{
		StoryID: storyID,
		UserID:  userID.(uuid.UUID),
		Content: req.Content,
	}
	if err := h.repo.AddComment(c.Request.Context(), comment); err != nil {
		response.InternalError(c, "Không thể bình luận")
		return
	}
	response.Created(c, gin.H{"comment": comment})
}

func (h *StoryHandler) ListComments(c *gin.Context) {
	storyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Story ID không hợp lệ")
		return
	}
	comments, err := h.repo.ListComments(c.Request.Context(), storyID)
	if err != nil {
		response.InternalError(c, "Lỗi")
		return
	}
	if comments == nil {
		comments = []repository.StoryComment{}
	}
	response.OK(c, gin.H{"comments": comments, "total": len(comments)})
}

func (h *StoryHandler) Delete(c *gin.Context) {
	userID, _ := c.Get("user_id")
	storyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Story ID không hợp lệ")
		return
	}
	if err := h.repo.Delete(c.Request.Context(), storyID, userID.(uuid.UUID)); err != nil {
		response.InternalError(c, "Lỗi")
		return
	}
	response.OK(c, gin.H{"message": "Đã xóa story"})
}

// ============================================
// 4. AI Translation Handler
// ============================================

type TranslateHandler struct{}

func NewTranslateHandler() *TranslateHandler {
	return &TranslateHandler{}
}

func (h *TranslateHandler) Translate(c *gin.Context) {
	var req struct {
		Text       string `json:"text" binding:"required"`
		SourceLang string `json:"source_lang"`
		TargetLang string `json:"target_lang" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu text hoặc target_lang")
		return
	}

	if req.SourceLang == "" {
		req.SourceLang = "auto"
	}

	// Common translations for demo
	translations := map[string]map[string]string{
		"vi": {
			"Xin chào":      "Hello",
			"Cảm ơn":        "Thank you",
			"Bao nhiêu tiền": "How much does it cost?",
			"Ở đâu":         "Where is it?",
		},
	}

	translated := req.Text
	if req.TargetLang == "en" {
		if t, ok := translations["vi"][req.Text]; ok {
			translated = t
		} else {
			translated = fmt.Sprintf("[EN] %s", req.Text)
		}
	} else if req.TargetLang == "ko" {
		translated = fmt.Sprintf("[KO] %s", req.Text)
	} else if req.TargetLang == "ja" {
		translated = fmt.Sprintf("[JA] %s", req.Text)
	} else if req.TargetLang == "zh" {
		translated = fmt.Sprintf("[ZH] %s", req.Text)
	}

	response.OK(c, gin.H{
		"original":    req.Text,
		"translated":  translated,
		"source_lang": req.SourceLang,
		"target_lang": req.TargetLang,
	})
}

func (h *TranslateHandler) DetectLanguage(c *gin.Context) {
	var req struct {
		Text string `json:"text" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu text")
		return
	}

	// Simple detection
	lang := "vi"
	for _, r := range req.Text {
		if r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' {
			lang = "en"
			break
		}
	}

	response.OK(c, gin.H{
		"text":     req.Text,
		"language": lang,
		"confidence": 0.85,
	})
}

// ============================================
// 5. Collections (Bookmarks) Handler
// ============================================

type CollectionHandler struct {
	repo *repository.CollectionRepository
}

func NewCollectionHandler(repo *repository.CollectionRepository) *CollectionHandler {
	return &CollectionHandler{repo: repo}
}

func (h *CollectionHandler) Create(c *gin.Context) {
	var col repository.Collection
	if err := c.ShouldBindJSON(&col); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ")
		return
	}
	userID, _ := c.Get("user_id")
	col.UserID = userID.(uuid.UUID)

	if col.Name == "" {
		response.BadRequest(c, "HT-VAL-001", "Thiếu tên collection")
		return
	}
	if err := h.repo.Create(c.Request.Context(), &col); err != nil {
		response.InternalError(c, "Không thể tạo collection")
		return
	}
	response.Created(c, gin.H{"collection": col})
}

func (h *CollectionHandler) List(c *gin.Context) {
	userID, _ := c.Get("user_id")
	cols, err := h.repo.ListByUser(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Lỗi")
		return
	}
	if cols == nil {
		cols = []repository.Collection{}
	}
	response.OK(c, gin.H{"collections": cols, "total": len(cols)})
}

func (h *CollectionHandler) AddItem(c *gin.Context) {
	var req struct {
		ItemType string `json:"item_type" binding:"required"`
		ItemID   string `json:"item_id" binding:"required"`
		Note     *string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ")
		return
	}
	collID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Collection ID không hợp lệ")
		return
	}
	itemID, err := uuid.Parse(req.ItemID)
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Item ID không hợp lệ")
		return
	}
	item := &repository.CollectionItem{
		CollectionID: collID,
		ItemType:     req.ItemType,
		ItemID:       itemID,
		Note:         req.Note,
	}
	if err := h.repo.AddItem(c.Request.Context(), item); err != nil {
		response.InternalError(c, "Không thể thêm")
		return
	}
	response.Created(c, gin.H{"item": item})
}

func (h *CollectionHandler) RemoveItem(c *gin.Context) {
	collID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Collection ID không hợp lệ")
		return
	}
	itemID, err := uuid.Parse(c.Param("item_id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Item ID không hợp lệ")
		return
	}
	if err := h.repo.RemoveItem(c.Request.Context(), collID, itemID); err != nil {
		response.InternalError(c, "Lỗi")
		return
	}
	response.OK(c, gin.H{"message": "Đã xóa khỏi collection"})
}

func (h *CollectionHandler) GetItems(c *gin.Context) {
	collID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Collection ID không hợp lệ")
		return
	}
	items, err := h.repo.GetItems(c.Request.Context(), collID)
	if err != nil {
		response.InternalError(c, "Lỗi")
		return
	}
	if items == nil {
		items = []repository.CollectionItem{}
	}
	response.OK(c, gin.H{"items": items, "total": len(items)})
}

func (h *CollectionHandler) Delete(c *gin.Context) {
	userID, _ := c.Get("user_id")
	collID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "HT-VAL-001", "Collection ID không hợp lệ")
		return
	}
	if err := h.repo.Delete(c.Request.Context(), collID, userID.(uuid.UUID)); err != nil {
		response.InternalError(c, "Lỗi")
		return
	}
	response.OK(c, gin.H{"message": "Đã xóa collection"})
}
