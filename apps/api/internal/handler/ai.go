package handler

import (
	"encoding/json"
	"errors"
	"strings"

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

// QuickSuggest — gợi ý nhanh theo context (Gemini khi có API key, static fallback)
func (h *AIHandler) QuickSuggest(c *gin.Context) {
	suggestType := c.DefaultQuery("type", "general")

	// Try Gemini-powered dynamic suggestions
	if h.aiService.HasAPIKey() {
		prompt := buildSuggestPrompt(suggestType)
		reply, err := h.aiService.Chat(c.Request.Context(), []service.AIChatMessage{
			{Role: "user", Content: prompt},
		})
		if err == nil && reply != "" {
			// Parse JSON array from reply
			jsonStr := extractSuggestJSON(reply)
			var dynamic []gin.H
			if json.Unmarshal([]byte(jsonStr), &dynamic) == nil && len(dynamic) > 0 {
				response.OK(c, gin.H{"suggestions": dynamic, "source": "ai"})
				return
			}
		}
	}

	// Fallback: curated static suggestions
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

	response.OK(c, gin.H{"suggestions": result, "source": "static"})
}

func buildSuggestPrompt(suggestType string) string {
	switch suggestType {
	case "food":
		return `Gợi ý 5 món ăn/quán ăn đặc sắc tại Huế. Trả về dạng JSON array:
[{"title":"emoji + tên quán","subtitle":"giá • địa chỉ","action":"navigate"}]
Chỉ trả JSON, không markdown.`
	case "sightseeing":
		return `Gợi ý 5 địa điểm tham quan tại Huế. Trả về dạng JSON array:
[{"title":"emoji + tên","subtitle":"giá vé • giờ mở cửa","action":"detail"}]
Chỉ trả JSON, không markdown.`
	default:
		return `Gợi ý 5 hoạt động du lịch thú vị tại Huế hôm nay. Trả về dạng JSON array:
[{"title":"emoji + tiêu đề","subtitle":"mô tả ngắn","action":"plan"}]
Chỉ trả JSON, không markdown.`
	}
}

func extractSuggestJSON(text string) string {
	text = strings.TrimSpace(text)
	// Find [ ... ] array in response
	start := strings.Index(text, "[")
	if start < 0 {
		return "[]"
	}
	depth := 0
	for i := start; i < len(text); i++ {
		if text[i] == '[' {
			depth++
		} else if text[i] == ']' {
			depth--
			if depth == 0 {
				return text[start : i+1]
			}
		}
	}
	return "[]"
}
