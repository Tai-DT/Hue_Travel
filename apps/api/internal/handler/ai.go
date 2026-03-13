package handler

import (
	"errors"

	"github.com/gin-gonic/gin"

	"github.com/huetravel/api/internal/service"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// AI Trip Planner Handler
// ============================================

type AIHandler struct {
	aiService *service.AITripPlannerService
}

func NewAIHandler(aiService *service.AITripPlannerService) *AIHandler {
	return &AIHandler{aiService: aiService}
}

// GenerateTripPlan — tạo lịch trình tự động
func (h *AIHandler) GenerateTripPlan(c *gin.Context) {
	var req service.TripPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ: "+err.Error())
		return
	}

	if req.Duration <= 0 || req.Duration > 14 {
		response.BadRequest(c, "HT-VAL-001", "Số ngày phải từ 1-14")
		return
	}

	if req.Budget == "" {
		req.Budget = "medium"
	}

	plan, err := h.aiService.GenerateTripPlan(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrServiceNotConfigured) || errors.Is(err, service.ErrServiceUnavailable) {
			response.ServiceUnavailable(c, "HT-AI-001", "AI planner hiện chưa sẵn sàng")
			return
		}
		response.InternalError(c, "Không thể tạo lịch trình")
		return
	}

	response.OK(c, gin.H{"plan": plan})
}

// Chat — trò chuyện với AI Guide
func (h *AIHandler) Chat(c *gin.Context) {
	var req struct {
		Messages []service.AIChatMessage `json:"messages" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Tin nhắn không hợp lệ")
		return
	}

	reply, err := h.aiService.Chat(c.Request.Context(), req.Messages)
	if err != nil {
		if errors.Is(err, service.ErrServiceNotConfigured) || errors.Is(err, service.ErrServiceUnavailable) {
			response.ServiceUnavailable(c, "HT-AI-002", "AI chat hiện chưa sẵn sàng")
			return
		}
		response.InternalError(c, "AI không khả dụng")
		return
	}

	response.OK(c, gin.H{
		"reply": reply,
		"role":  "assistant",
	})
}

// QuickSuggest — gợi ý nhanh theo context
func (h *AIHandler) QuickSuggest(c *gin.Context) {
	suggestType := c.DefaultQuery("type", "general")

	suggestions := map[string][]gin.H{
		"food": {
			{"title": "🍜 Bún bò Bà Tuyết", "subtitle": "35-50k • 47 Nguyễn Công Trứ", "action": "navigate"},
			{"title": "🥟 Bánh khoái Lạc Thiện", "subtitle": "30-45k • 6 Đinh Tiên Hoàng", "action": "navigate"},
			{"title": "🍚 Cơm hến Bà Oanh", "subtitle": "25-35k • 2 Hàn Mặc Tử", "action": "navigate"},
		},
		"sightseeing": {
			{"title": "🏛️ Đại Nội Huế", "subtitle": "200k • 7:00-17:30", "action": "detail"},
			{"title": "⛩️ Chùa Thiên Mụ", "subtitle": "Miễn phí • Cả ngày", "action": "detail"},
			{"title": "🌸 Lăng Tự Đức", "subtitle": "150k • 7:00-17:00", "action": "detail"},
		},
		"general": {
			{"title": "📅 Tạo lịch trình AI", "subtitle": "Lên kế hoạch du lịch thông minh", "action": "plan"},
			{"title": "🍜 Gợi ý ăn gì?", "subtitle": "Khám phá ẩm thực Huế", "action": "food"},
			{"title": "🗺️ Quanh đây có gì?", "subtitle": "Địa điểm gần bạn", "action": "nearby"},
		},
	}

	result, ok := suggestions[suggestType]
	if !ok {
		result = suggestions["general"]
	}

	response.OK(c, gin.H{"suggestions": result})
}
