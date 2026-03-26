package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ============================================
// AI Trip Planner Service (Gemini)
// ============================================

type AITripPlannerService struct {
	apiKey          string
	modelName       string
	httpClient      *http.Client
	fallbackEnabled bool
}

func NewAITripPlannerService(apiKey string) *AITripPlannerService {
	return NewAITripPlannerServiceWithFallback(apiKey, true)
}

func NewAITripPlannerServiceWithFallback(apiKey string, fallbackEnabled bool) *AITripPlannerService {
	return &AITripPlannerService{
		apiKey:          apiKey,
		modelName:       "gemini-2.0-flash",
		httpClient:      &http.Client{Timeout: 30 * time.Second},
		fallbackEnabled: fallbackEnabled,
	}
}

func (s *AITripPlannerService) HasAPIKey() bool {
	return s.apiKey != "" && s.apiKey != "your_gemini_api_key"
}

func (s *AITripPlannerService) FallbackEnabled() bool {
	return s.fallbackEnabled
}

// ============================================
// Trip Plan Types
// ============================================

type TripPlanRequest struct {
	Duration    int      `json:"duration"`     // days
	Budget      string   `json:"budget"`       // low, medium, high
	Interests   []string `json:"interests"`    // food, culture, nature, history, photography
	TravelStyle string   `json:"travel_style"` // solo, couple, family, group
	StartDate   string   `json:"start_date"`   // optional
	Notes       string   `json:"notes"`        // optional free text
}

type TripPlan struct {
	Title       string    `json:"title"`
	Summary     string    `json:"summary"`
	Duration    int       `json:"duration"`
	TotalBudget string    `json:"total_budget"`
	Days        []DayPlan `json:"days"`
	Tips        []string  `json:"tips"`
	PackingList []string  `json:"packing_list"`
}

type DayPlan struct {
	Day        int           `json:"day"`
	Theme      string        `json:"theme"`
	Activities []Activity    `json:"activities"`
	Meals      []MealSuggest `json:"meals"`
	EstCost    string        `json:"estimated_cost"`
}

type Activity struct {
	Time        string `json:"time"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Duration    string `json:"duration"`
	Location    string `json:"location"`
	Cost        string `json:"cost"`
	Tips        string `json:"tips,omitempty"`
}

type MealSuggest struct {
	Type       string `json:"type"` // breakfast, lunch, dinner, snack
	Name       string `json:"name"`
	Location   string `json:"location"`
	MustTry    string `json:"must_try"`
	PriceRange string `json:"price_range"`
}

// ChatMessage for AI conversation
type AIChatMessage struct {
	Role    string `json:"role"` // user, assistant
	Content string `json:"content"`
}

// ============================================
// Generate Trip Plan
// ============================================

func (s *AITripPlannerService) GenerateTripPlan(ctx context.Context, req TripPlanRequest) (*TripPlan, error) {
	if !s.HasAPIKey() {
		if !s.fallbackEnabled {
			return nil, fmt.Errorf("%w: Gemini API key is missing", ErrServiceNotConfigured)
		}
		return s.mockTripPlan(req), nil
	}

	prompt := s.buildTripPlanPrompt(req)
	response, err := s.callGemini(ctx, prompt)
	if err != nil {
		if !s.fallbackEnabled {
			return nil, fmt.Errorf("%w: Gemini trip planner request failed: %v", ErrServiceUnavailable, err)
		}
		return s.mockTripPlan(req), nil
	}

	var plan TripPlan
	// Try to parse JSON from response
	jsonStr := extractJSON(response)
	if err := json.Unmarshal([]byte(jsonStr), &plan); err != nil {
		if !s.fallbackEnabled {
			return nil, fmt.Errorf("%w: Gemini returned invalid trip plan JSON", ErrServiceUnavailable)
		}
		return s.mockTripPlan(req), nil
	}

	return &plan, nil
}

// ============================================
// AI Chat (conversational trip planning)
// ============================================

func (s *AITripPlannerService) Chat(ctx context.Context, messages []AIChatMessage) (string, error) {
	if !s.HasAPIKey() {
		if !s.fallbackEnabled {
			return "", fmt.Errorf("%w: Gemini API key is missing", ErrServiceNotConfigured)
		}
		return s.mockChatResponse(messages), nil
	}

	systemPrompt := `Bạn là "Huế AI Guide" — trợ lý du lịch AI chuyên về thành phố Huế, Việt Nam.

Quy tắc:
- Trả lời bằng tiếng Việt, thân thiện, nhiệt tình 
- Chuyên gia về: ẩm thực Huế, di sản UNESCO, lịch sử triều Nguyễn, thiên nhiên, văn hoá
- Gợi ý cụ thể: tên quán, địa chỉ, giá cả, giờ mở cửa
- Khi gợi ý lịch trình, format rõ ràng theo thời gian
- Sử dụng emoji phù hợp
- Luôn hỏi thêm về sở thích để cá nhân hoá
- Nếu không chắc chắn, nói rõ và đề xuất alternative

Kiến thức đặc biệt:
- Bún bò Huế: Bà Tuyết (47 Nguyễn Công Trứ), Bà Phước (phố Hùng Vương)
- Bánh khoái: Lạc Thiện (6 Đinh Tiên Hoàng)
- Cơm hến: Bà Oanh (2 Hàn Mặc Tử)  
- Đại Nội: mở 7:00-17:30, vé 200k, nên đi sáng sớm
- Chùa Thiên Mụ: miễn phí, đẹp nhất lúc bình minh
- Sông Hương: chèo thuyền 150-300k/người, đẹp nhất hoàng hôn
- Mùa đẹp nhất: tháng 2-4 (xuân), tránh tháng 10-11 (mưa lũ)`

	var geminiMessages []map[string]interface{}
	geminiMessages = append(geminiMessages, map[string]interface{}{
		"role":  "user",
		"parts": []map[string]string{{"text": systemPrompt}},
	})
	geminiMessages = append(geminiMessages, map[string]interface{}{
		"role":  "model",
		"parts": []map[string]string{{"text": "Chào bạn! Mình là Huế AI Guide 🌏 Mình rất vui được giúp bạn khám phá Huế. Bạn muốn tìm hiểu về gì nào? 😊"}},
	})

	for _, msg := range messages {
		role := "user"
		if msg.Role == "assistant" {
			role = "model"
		}
		geminiMessages = append(geminiMessages, map[string]interface{}{
			"role":  role,
			"parts": []map[string]string{{"text": msg.Content}},
		})
	}

	body := map[string]interface{}{
		"contents": geminiMessages,
		"generationConfig": map[string]interface{}{
			"temperature":     0.8,
			"maxOutputTokens": 1024,
		},
	}

	jsonBody, _ := json.Marshal(body)
	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		s.modelName, s.apiKey,
	)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		if !s.fallbackEnabled {
			return "", fmt.Errorf("%w: Gemini chat request failed: %v", ErrServiceUnavailable, err)
		}
		return s.mockChatResponse(messages), nil
	}
	defer resp.Body.Close()
	if resp.StatusCode >= http.StatusBadRequest {
		if !s.fallbackEnabled {
			return "", fmt.Errorf("%w: Gemini chat returned status %d", ErrServiceUnavailable, resp.StatusCode)
		}
		return s.mockChatResponse(messages), nil
	}

	respBody, _ := io.ReadAll(resp.Body)

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(respBody, &result); err != nil || len(result.Candidates) == 0 {
		if !s.fallbackEnabled {
			return "", fmt.Errorf("%w: Gemini returned invalid chat response", ErrServiceUnavailable)
		}
		return s.mockChatResponse(messages), nil
	}

	return result.Candidates[0].Content.Parts[0].Text, nil
}

// ============================================
// Gemini API Call
// ============================================

func (s *AITripPlannerService) callGemini(ctx context.Context, prompt string) (string, error) {
	body := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]string{{"text": prompt}},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":      0.7,
			"maxOutputTokens":  4096,
			"responseMimeType": "application/json",
		},
	}

	jsonBody, _ := json.Marshal(body)
	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		s.modelName, s.apiKey,
	)

	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= http.StatusBadRequest {
		return "", fmt.Errorf("gemini returned status %d", resp.StatusCode)
	}

	respBody, _ := io.ReadAll(resp.Body)

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(respBody, &result); err != nil || len(result.Candidates) == 0 {
		return "", fmt.Errorf("invalid API response")
	}

	return result.Candidates[0].Content.Parts[0].Text, nil
}

func (s *AITripPlannerService) buildTripPlanPrompt(req TripPlanRequest) string {
	return fmt.Sprintf(`Tạo lịch trình du lịch Huế chi tiết dưới dạng JSON.

Thông tin:
- Số ngày: %d
- Ngân sách: %s (low=dưới 1 triệu/ngày, medium=1-3 triệu/ngày, high=trên 3 triệu/ngày)
- Sở thích: %s  
- Phong cách: %s
- Ghi chú: %s

Format JSON:
{
  "title": "Tiêu đề hấp dẫn",
  "summary": "Tóm tắt 2-3 câu",
  "duration": %d,
  "total_budget": "X triệu VND",
  "days": [
    {
      "day": 1,
      "theme": "Chủ đề ngày",
      "activities": [
        {"time": "07:00", "name": "Tên", "description": "Mô tả", "duration": "2h", "location": "Địa chỉ", "cost": "200,000₫", "tips": "Mẹo"}
      ],
      "meals": [
        {"type": "breakfast", "name": "Bún bò Bà Tuyết", "location": "47 Nguyễn Công Trứ", "must_try": "Bún bò đặc biệt", "price_range": "35,000-50,000₫"}
      ],
      "estimated_cost": "500,000₫"
    }
  ],
  "tips": ["Mẹo 1", "Mẹo 2"],
  "packing_list": ["Nón lá", "Kem chống nắng"]
}

Hãy tạo lịch trình thực tế, chi tiết với địa chỉ và giá cả chính xác tại Huế.`,
		req.Duration,
		req.Budget,
		strings.Join(req.Interests, ", "),
		req.TravelStyle,
		req.Notes,
		req.Duration,
	)
}

// ============================================
// Mock Data
// ============================================

func (s *AITripPlannerService) mockTripPlan(req TripPlanRequest) *TripPlan {
	return &TripPlan{
		Title:       "Khám phá Huế — Hành trình Di sản & Ẩm thực",
		Summary:     "Lịch trình hoàn hảo để trải nghiệm tinh hoa văn hoá cố đô Huế, từ di sản UNESCO đến ẩm thực đường phố.",
		Duration:    req.Duration,
		TotalBudget: "2,500,000₫",
		Days: []DayPlan{
			{
				Day:   1,
				Theme: "🏛️ Di sản Hoàng Cung",
				Activities: []Activity{
					{Time: "07:00", Name: "Đại Nội Huế", Description: "Khám phá Tử Cấm Thành, Điện Thái Hoà, và vườn Ngự Uyển", Duration: "3h", Location: "Đường 23/8, Thuận Hoà", Cost: "200,000₫", Tips: "Đi sáng sớm tránh nắng, thuê áo dài 100k"},
					{Time: "10:30", Name: "Chùa Thiên Mụ", Description: "Ngôi chùa cổ nhất Huế bên bờ sông Hương", Duration: "1h", Location: "Kim Long", Cost: "Miễn phí"},
					{Time: "14:00", Name: "Lăng Tự Đức", Description: "Lăng mộ đẹp nhất với hồ sen và rừng thông", Duration: "2h", Location: "Thủy Xuân", Cost: "150,000₫"},
					{Time: "17:00", Name: "Chèo thuyền sông Hương", Description: "Ngắm hoàng hôn, nghe ca Huế", Duration: "1.5h", Location: "Bến thuyền Toà Khâm", Cost: "200,000₫"},
				},
				Meals: []MealSuggest{
					{Type: "breakfast", Name: "Bún bò Bà Tuyết", Location: "47 Nguyễn Công Trứ", MustTry: "Bún bò đặc biệt + chả cua", PriceRange: "35,000-50,000₫"},
					{Type: "lunch", Name: "Cơm hến Bà Oanh", Location: "2 Hàn Mặc Tử", MustTry: "Cơm hến + chè bột lọc", PriceRange: "25,000-40,000₫"},
					{Type: "dinner", Name: "Quán Chè Hẻm", Location: "1 Hùng Vương", MustTry: "Chè đậu ván + chè bắp", PriceRange: "15,000-25,000₫"},
				},
				EstCost: "800,000₫",
			},
		},
		Tips: []string{
			"🌧️ Mang theo áo mưa — thời tiết Huế thay đổi nhanh",
			"👘 Thuê áo dài tại Đại Nội chỉ 100k, ảnh rất đẹp",
			"🛵 Thuê xe máy 120k/ngày tại phố Lê Lợi",
			"💰 Luôn mang tiền mặt — nhiều quán nhỏ không nhận thẻ",
			"📸 Golden hour: 5:30-6:30 sáng tại Thiên Mụ, 17:00-18:00 tại cầu Trường Tiền",
		},
		PackingList: []string{
			"Nón lá (hoặc mua tại Huế ~30k)",
			"Kem chống nắng SPF50+",
			"Giày thoải mái (đi bộ nhiều)",
			"Áo mưa nhẹ",
			"Pin sạc dự phòng",
		},
	}
}

func (s *AITripPlannerService) mockChatResponse(messages []AIChatMessage) string {
	if len(messages) == 0 {
		return "Chào bạn! 🌏 Mình là Huế AI Guide. Bạn đang plan trip đến Huế phải không? Cho mình biết:\n\n1. Bạn đi mấy ngày?\n2. Bạn thích ẩm thực hay lịch sử hơn?\n3. Ngân sách khoảng bao nhiêu?\n\nMình sẽ gợi ý lịch trình cực chill cho bạn! 😊"
	}

	lastMsg := strings.ToLower(messages[len(messages)-1].Content)

	if strings.Contains(lastMsg, "ăn") || strings.Contains(lastMsg, "food") || strings.Contains(lastMsg, "ẩm thực") {
		return "Ẩm thực Huế thì phải thử những món này! 🍜\n\n**Top 5 MUST-TRY:**\n1. 🍜 **Bún bò Huế** — Bà Tuyết (47 Nguyễn Công Trứ) — 35-50k\n2. 🥟 **Bánh khoái** — Lạc Thiện (6 Đinh Tiên Hoàng) — 30-45k\n3. 🍚 **Cơm hến** — Bà Oanh (2 Hàn Mặc Tử) — 25-35k\n4. 🌯 **Nem lụi** — Bà Đào (23 Nguyễn Thái Học) — 40-60k\n5. 🍮 **Chè Huế** — Chè Hẻm (1 Hùng Vương) — 15-25k\n\n💡 **Mẹo:** Ăn bún bò sáng sớm (6-8h), quán vắng và nước dùng đậm nhất!\n\nBạn muốn mình gợi ý street food tour không? 🛵"
	}

	if strings.Contains(lastMsg, "đại nội") || strings.Contains(lastMsg, "di sản") || strings.Contains(lastMsg, "lịch sử") {
		return "Đại Nội Huế — Di sản UNESCO! 🏛️\n\n**Thông tin:**\n- ⏰ Giờ mở: 7:00 - 17:30\n- 🎫 Vé: 200,000₫/người\n- ⏱️ Thời gian: 2-3 tiếng\n\n**Lộ trình gợi ý:**\n1. Ngọ Môn → Điện Thái Hoà (30 phút)\n2. Tử Cấm Thành → Cung Diên Thọ (45 phút)\n3. Vườn Cơ Hạ → Hiển Lâm Các (30 phút)\n4. Thế miếu → 9 đỉnh đồng (20 phút)\n\n💡 **Tips:**\n- Đi sáng sớm (7h) tránh đông\n- Thuê áo dài ngay cổng (~100k), ảnh siêu đẹp!\n- Thuê guide thuyết minh ~300k, rất đáng\n\nBạn muốn biết thêm về lăng tẩm hay chùa chiền không? 😊"
	}

	return "Cảm ơn bạn! 🙏\n\nĐể mình gợi ý tốt hơn, bạn cho mình biết thêm:\n\n🗓️ Bạn đi Huế mấy ngày?\n💰 Ngân sách khoảng bao nhiêu?\n❤️ Bạn thích khám phá gì nhất: ẩm thực, lịch sử, thiên nhiên, hay chụp ảnh?\n\nMình sẽ tạo lịch trình \"may đo\" cho bạn luôn! 🎯"
}

// Helper: extract JSON from text (Gemini sometimes wraps in markdown)
func extractJSON(text string) string {
	text = strings.TrimSpace(text)
	if start := strings.Index(text, "{"); start >= 0 {
		depth := 0
		for i := start; i < len(text); i++ {
			switch text[i] {
			case '{':
				depth++
			case '}':
				depth--
				if depth == 0 {
					return text[start : i+1]
				}
			}
		}
	}
	return text
}
