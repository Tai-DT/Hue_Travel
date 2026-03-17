package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ============================================
// Goong Places Service
// ============================================

type GoongPlacesService struct {
	apiKey          string
	httpClient      *http.Client
	fallbackEnabled bool
}

func NewGoongPlacesService(apiKey string) *GoongPlacesService {
	return NewGoongPlacesServiceWithFallback(apiKey, true)
}

func NewGoongPlacesServiceWithFallback(apiKey string, fallbackEnabled bool) *GoongPlacesService {
	return &GoongPlacesService{
		apiKey:          apiKey,
		fallbackEnabled: fallbackEnabled,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (s *GoongPlacesService) HasAPIKey() bool {
	trimmed := strings.TrimSpace(s.apiKey)
	return trimmed != "" &&
		trimmed != "your_goong_api_key" &&
		trimmed != "your_google_maps_api_key"
}

func (s *GoongPlacesService) NearbySearch(ctx context.Context, lat, lng float64, radius int, placeType string) ([]PlaceResult, error) {
	if !s.HasAPIKey() {
		if !s.fallbackEnabled {
			return nil, fmt.Errorf("%w: Goong API key is missing", ErrServiceNotConfigured)
		}
		return s.mockNearbyResults(), nil
	}

	places, err := s.searchPlaces(ctx, goongSearchQueryForType(placeType), lat, lng, metersToGoongRadius(radius))
	if err != nil {
		if !s.fallbackEnabled {
			return nil, fmt.Errorf("%w: Goong nearby search failed: %v", ErrServiceUnavailable, err)
		}
		return nil, fmt.Errorf("goong nearby search error: %w", err)
	}

	return places, nil
}

func (s *GoongPlacesService) TextSearch(ctx context.Context, query string, lat, lng float64) ([]PlaceResult, error) {
	if !s.HasAPIKey() {
		if !s.fallbackEnabled {
			return nil, fmt.Errorf("%w: Goong API key is missing", ErrServiceNotConfigured)
		}
		return s.mockSearchResults(query), nil
	}

	places, err := s.searchPlaces(ctx, normalizeGoongQuery(query), lat, lng, 10)
	if err != nil {
		if !s.fallbackEnabled {
			return nil, fmt.Errorf("%w: Goong text search failed: %v", ErrServiceUnavailable, err)
		}
		return nil, fmt.Errorf("goong text search error: %w", err)
	}

	return places, nil
}

func (s *GoongPlacesService) GetDirections(ctx context.Context, originLat, originLng, destLat, destLng float64, mode string) (*DirectionResult, error) {
	if !s.HasAPIKey() {
		if !s.fallbackEnabled {
			return nil, fmt.Errorf("%w: Goong API key is missing", ErrServiceNotConfigured)
		}
		return s.mockDirection(), nil
	}

	params := url.Values{}
	params.Set("origin", fmt.Sprintf("%f,%f", originLat, originLng))
	params.Set("destination", fmt.Sprintf("%f,%f", destLat, destLng))
	params.Set("vehicle", goongVehicle(mode))
	params.Set("api_key", s.apiKey)

	var result struct {
		Routes []struct {
			Legs []struct {
				Distance struct {
					Text string `json:"text"`
				} `json:"distance"`
				Duration struct {
					Text  string `json:"text"`
					Value int    `json:"value"`
				} `json:"duration"`
				StartAddress string `json:"start_address"`
				EndAddress   string `json:"end_address"`
				Steps        []struct {
					HTMLInstructions string                `json:"html_instructions"`
					Distance         struct{ Text string } `json:"distance"`
					Duration         struct{ Text string } `json:"duration"`
					StartLocation    struct {
						Lat float64 `json:"lat"`
						Lng float64 `json:"lng"`
					} `json:"start_location"`
					EndLocation struct {
						Lat float64 `json:"lat"`
						Lng float64 `json:"lng"`
					} `json:"end_location"`
				} `json:"steps"`
			} `json:"legs"`
			OverviewPolyline struct {
				Points string `json:"points"`
			} `json:"overview_polyline"`
		} `json:"routes"`
		Status       string `json:"status"`
		ErrorMessage string `json:"error_message"`
	}

	if err := s.doJSONRequest(ctx, "https://rsapi.goong.io/Direction?"+params.Encode(), &result); err != nil {
		if !s.fallbackEnabled {
			return nil, fmt.Errorf("%w: Goong directions request failed: %v", ErrServiceUnavailable, err)
		}
		return nil, fmt.Errorf("goong directions error: %w", err)
	}

	if result.Status != "" && result.Status != "OK" {
		return nil, fmt.Errorf("goong directions returned status %s: %s", result.Status, result.ErrorMessage)
	}
	if len(result.Routes) == 0 || len(result.Routes[0].Legs) == 0 {
		return nil, fmt.Errorf("goong directions returned no route")
	}

	leg := result.Routes[0].Legs[0]
	dir := &DirectionResult{
		Distance:     leg.Distance.Text,
		Duration:     leg.Duration.Text,
		DurationSecs: leg.Duration.Value,
		StartAddress: leg.StartAddress,
		EndAddress:   leg.EndAddress,
		Polyline:     result.Routes[0].OverviewPolyline.Points,
	}

	for _, step := range leg.Steps {
		dir.Steps = append(dir.Steps, Step{
			Instruction: step.HTMLInstructions,
			Distance:    step.Distance.Text,
			Duration:    step.Duration.Text,
			StartLat:    step.StartLocation.Lat,
			StartLng:    step.StartLocation.Lng,
			EndLat:      step.EndLocation.Lat,
			EndLng:      step.EndLocation.Lng,
		})
	}

	return dir, nil
}

type goongPrediction struct {
	Description          string   `json:"description"`
	PlaceID              string   `json:"place_id"`
	Types                []string `json:"types"`
	StructuredFormatting struct {
		MainText      string `json:"main_text"`
		SecondaryText string `json:"secondary_text"`
	} `json:"structured_formatting"`
}

func (p goongPrediction) mainText() string {
	if strings.TrimSpace(p.StructuredFormatting.MainText) != "" {
		return p.StructuredFormatting.MainText
	}
	if p.Description == "" {
		return ""
	}
	parts := strings.Split(p.Description, ",")
	return strings.TrimSpace(parts[0])
}

func (s *GoongPlacesService) searchPlaces(ctx context.Context, query string, lat, lng float64, radiusKm int) ([]PlaceResult, error) {
	predictions, err := s.autoComplete(ctx, query, lat, lng, radiusKm)
	if err != nil {
		return nil, err
	}
	if len(predictions) == 0 {
		return []PlaceResult{}, nil
	}

	// Extract keywords from query for relevance filtering
	keywords := extractKeywords(query)

	places := make([]PlaceResult, 0, len(predictions))
	seen := make(map[string]struct{}, len(predictions))

	for _, prediction := range predictions {
		if prediction.PlaceID == "" {
			continue
		}
		if _, exists := seen[prediction.PlaceID]; exists {
			continue
		}
		seen[prediction.PlaceID] = struct{}{}

		// Filter out predictions that don't match any keywords
		if len(keywords) > 0 && !isPredictionRelevant(prediction, keywords) {
			continue
		}

		place, err := s.placeDetail(ctx, prediction.PlaceID)
		if err != nil {
			places = append(places, PlaceResult{
				PlaceID: prediction.PlaceID,
				Name:    prediction.mainText(),
				Address: prediction.Description,
				Lat:     lat,
				Lng:     lng,
				Types:   prediction.Types,
			})
			continue
		}

		if place.Name == "" {
			place.Name = prediction.mainText()
		}
		if place.Address == "" {
			place.Address = prediction.Description
		}
		if len(place.Types) == 0 {
			place.Types = prediction.Types
		}

		places = append(places, place)

		// Limit results for performance
		if len(places) >= 8 {
			break
		}
	}

	return places, nil
}


func (s *GoongPlacesService) autoComplete(ctx context.Context, input string, lat, lng float64, radiusKm int) ([]goongPrediction, error) {
	params := url.Values{}
	params.Set("input", input)
	params.Set("api_key", s.apiKey)
	params.Set("more_compound", "true")

	if lat != 0 || lng != 0 {
		params.Set("location", fmt.Sprintf("%f,%f", lat, lng))
	}
	if radiusKm > 0 {
		params.Set("radius", fmt.Sprintf("%d", radiusKm))
	}

	var result struct {
		Predictions  []goongPrediction `json:"predictions"`
		Status       string            `json:"status"`
		ErrorMessage string            `json:"error_message"`
	}

	if err := s.doJSONRequest(ctx, "https://rsapi.goong.io/Place/AutoComplete?"+params.Encode(), &result); err != nil {
		return nil, err
	}
	if result.Status != "" && result.Status != "OK" && result.Status != "ZERO_RESULTS" {
		return nil, fmt.Errorf("goong autocomplete returned status %s: %s", result.Status, result.ErrorMessage)
	}

	return result.Predictions, nil
}

func (s *GoongPlacesService) placeDetail(ctx context.Context, placeID string) (PlaceResult, error) {
	params := url.Values{}
	params.Set("placeid", placeID)
	params.Set("api_key", s.apiKey)

	var result struct {
		Result struct {
			PlaceID          string `json:"place_id"`
			Name             string `json:"name"`
			FormattedAddress string `json:"formatted_address"`
			Geometry         struct {
				Location struct {
					Lat float64 `json:"lat"`
					Lng float64 `json:"lng"`
				} `json:"location"`
			} `json:"geometry"`
			Rating           float64  `json:"rating"`
			UserRatingsTotal int      `json:"user_ratings_total"`
			PriceLevel       int      `json:"price_level"`
			Types            []string `json:"types"`
		} `json:"result"`
		Status       string `json:"status"`
		ErrorMessage string `json:"error_message"`
	}

	if err := s.doJSONRequest(ctx, "https://rsapi.goong.io/Place/Detail?"+params.Encode(), &result); err != nil {
		return PlaceResult{}, err
	}
	if result.Status != "" && result.Status != "OK" {
		return PlaceResult{}, fmt.Errorf("goong place detail returned status %s: %s", result.Status, result.ErrorMessage)
	}

	return PlaceResult{
		PlaceID:     result.Result.PlaceID,
		Name:        result.Result.Name,
		Address:     result.Result.FormattedAddress,
		Lat:         result.Result.Geometry.Location.Lat,
		Lng:         result.Result.Geometry.Location.Lng,
		Rating:      result.Result.Rating,
		RatingCount: result.Result.UserRatingsTotal,
		PriceLevel:  result.Result.PriceLevel,
		Types:       result.Result.Types,
	}, nil
}

func (s *GoongPlacesService) doJSONRequest(ctx context.Context, requestURL string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode >= 400 {
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	if err := json.Unmarshal(body, dst); err != nil {
		return err
	}

	return nil
}

func normalizeGoongQuery(query string) string {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return "địa điểm Huế"
	}

	lowered := strings.ToLower(trimmed)
	if strings.Contains(lowered, "huế") || strings.Contains(lowered, "hue") {
		return trimmed
	}

	return trimmed + " Huế"
}

func goongSearchQueryForType(placeType string) string {
	switch strings.ToLower(strings.TrimSpace(placeType)) {
	case "restaurant":
		return "nhà hàng Huế"
	case "cafe":
		return "quán cafe Huế"
	case "museum":
		return "bảo tàng Huế"
	case "park":
		return "công viên Huế"
	case "lodging":
		return "khách sạn Huế"
	case "tourist_attraction":
		return "địa điểm du lịch Huế"
	default:
		if strings.TrimSpace(placeType) == "" {
			return "địa điểm Huế"
		}
		return normalizeGoongQuery(placeType)
	}
}

func metersToGoongRadius(radius int) int {
	if radius <= 0 {
		return 2
	}

	km := int(math.Ceil(float64(radius) / 1000))
	if km < 1 {
		km = 1
	}
	if km > 50 {
		km = 50
	}

	return km
}

// extractKeywords returns meaningful search keywords from a query string.
func extractKeywords(query string) []string {
	stopWords := map[string]bool{
		"của": true, "và": true, "ở": true, "tại": true, "với": true,
		"các": true, "những": true, "trong": true, "cho": true, "từ": true,
		"gần": true, "đây": true, "huế": true, "hue": true, "thành": true, "phố": true,
	}

	words := strings.Fields(strings.ToLower(query))
	keywords := make([]string, 0, len(words))
	for _, w := range words {
		w = strings.TrimSpace(w)
		if len([]rune(w)) <= 2 || stopWords[w] {
			continue
		}
		keywords = append(keywords, w)
	}
	return keywords
}

// isPredictionRelevant checks if a Goong prediction matches any search keyword.
func isPredictionRelevant(prediction goongPrediction, keywords []string) bool {
	text := strings.ToLower(prediction.Description + " " + prediction.mainText())
	for _, kw := range keywords {
		if strings.Contains(text, kw) {
			return true
		}
	}
	// Also check types
	for _, t := range prediction.Types {
		for _, kw := range keywords {
			if strings.Contains(strings.ToLower(t), kw) {
				return true
			}
		}
	}
	return false
}


func goongVehicle(mode string) string {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "bicycling", "bike", "motorbike":
		return "bike"
	case "taxi":
		return "taxi"
	case "truck":
		return "truck"
	default:
		return "car"
	}
}

func (s *GoongPlacesService) mockNearbyResults() []PlaceResult {
	return []PlaceResult{
		{PlaceID: "mock_1", Name: "Bún Bò Huế Bà Tuyết", Address: "47 Nguyễn Công Trứ, Huế", Lat: 16.4637, Lng: 107.5909, Rating: 4.5, RatingCount: 234, PriceLevel: 1, Types: []string{"restaurant"}},
		{PlaceID: "mock_2", Name: "Cơm Hến Bà Oanh", Address: "2 Hàn Mặc Tử, Huế", Lat: 16.4712, Lng: 107.5801, Rating: 4.3, RatingCount: 156, PriceLevel: 1, Types: []string{"restaurant"}},
		{PlaceID: "mock_3", Name: "Bánh Khoái Lạc Thiện", Address: "6 Đinh Tiên Hoàng, Huế", Lat: 16.4678, Lng: 107.5859, Rating: 4.4, RatingCount: 312, PriceLevel: 1, Types: []string{"restaurant"}},
		{PlaceID: "mock_4", Name: "Quán Chè Hẻm", Address: "1 Hùng Vương, Huế", Lat: 16.4601, Lng: 107.5882, Rating: 4.6, RatingCount: 89, PriceLevel: 1, Types: []string{"cafe"}},
		{PlaceID: "mock_5", Name: "Nem Lụi Bà Đào", Address: "23 Nguyễn Thái Học, Huế", Lat: 16.4655, Lng: 107.5845, Rating: 4.2, RatingCount: 178, PriceLevel: 1, Types: []string{"restaurant"}},
	}
}

func (s *GoongPlacesService) mockSearchResults(query string) []PlaceResult {
	q := strings.ToLower(query)

	// Food queries
	if strings.Contains(q, "nhà hàng") || strings.Contains(q, "ẩm thực") || strings.Contains(q, "quán ăn") || strings.Contains(q, "food") {
		return []PlaceResult{
			{PlaceID: "food_1", Name: "Bún Bò Huế Bà Tuyết", Address: "47 Nguyễn Công Trứ, Huế", Lat: 16.4637, Lng: 107.5909, Rating: 4.5, RatingCount: 234, PriceLevel: 1, Types: []string{"restaurant", "food"}},
			{PlaceID: "food_2", Name: "Cơm Hến Bà Oanh", Address: "2 Hàn Mặc Tử, Huế", Lat: 16.4712, Lng: 107.5801, Rating: 4.3, RatingCount: 156, PriceLevel: 1, Types: []string{"restaurant", "food"}},
			{PlaceID: "food_3", Name: "Bánh Khoái Lạc Thiện", Address: "6 Đinh Tiên Hoàng, Huế", Lat: 16.4678, Lng: 107.5859, Rating: 4.4, RatingCount: 312, PriceLevel: 1, Types: []string{"restaurant", "food"}},
			{PlaceID: "food_4", Name: "Bún Thịt Nướng Huyền Anh", Address: "35 Nguyễn Thái Học, Huế", Lat: 16.4625, Lng: 107.5870, Rating: 4.6, RatingCount: 89, PriceLevel: 1, Types: []string{"restaurant", "food"}},
			{PlaceID: "food_5", Name: "Quán Chè Hẻm", Address: "1 Hùng Vương, Huế", Lat: 16.4601, Lng: 107.5882, Rating: 4.6, RatingCount: 92, PriceLevel: 1, Types: []string{"cafe"}},
		}
	}

	// Temple queries
	if strings.Contains(q, "chùa") || strings.Contains(q, "đền") || strings.Contains(q, "temple") {
		return []PlaceResult{
			{PlaceID: "temple_1", Name: "Chùa Thiên Mụ", Address: "Kim Long, Huế", Lat: 16.4539, Lng: 107.5534, Rating: 4.6, RatingCount: 987, Types: []string{"place_of_worship", "tourist_attraction"}},
			{PlaceID: "temple_2", Name: "Chùa Từ Hiếu", Address: "Thủy Xuân, Huế", Lat: 16.4488, Lng: 107.5602, Rating: 4.5, RatingCount: 324, Types: []string{"place_of_worship"}},
			{PlaceID: "temple_3", Name: "Đền Hòn Chén", Address: "Thủy Bằng, Hương Thủy, Huế", Lat: 16.4298, Lng: 107.5423, Rating: 4.4, RatingCount: 215, Types: []string{"place_of_worship"}},
			{PlaceID: "temple_4", Name: "Chùa Từ Đàm", Address: "1 Sư Liễu Quán, Huế", Lat: 16.4612, Lng: 107.5856, Rating: 4.3, RatingCount: 178, Types: []string{"place_of_worship"}},
		}
	}

	// Nature queries
	if strings.Contains(q, "thiên nhiên") || strings.Contains(q, "công viên") || strings.Contains(q, "nature") || strings.Contains(q, "park") {
		return []PlaceResult{
			{PlaceID: "nature_1", Name: "Vườn Quốc gia Bạch Mã", Address: "Phú Lộc, Thừa Thiên Huế", Lat: 16.2025, Lng: 107.8518, Rating: 4.5, RatingCount: 456, Types: []string{"park", "natural_feature"}},
			{PlaceID: "nature_2", Name: "Biển Thuận An", Address: "Phú Vang, Thừa Thiên Huế", Lat: 16.5587, Lng: 107.6456, Rating: 4.3, RatingCount: 789, Types: []string{"natural_feature"}},
			{PlaceID: "nature_3", Name: "Đầm Lập An", Address: "Phú Lộc, Thừa Thiên Huế", Lat: 16.2843, Lng: 107.9561, Rating: 4.4, RatingCount: 234, Types: []string{"natural_feature"}},
			{PlaceID: "nature_4", Name: "Công viên Thương Bạc", Address: "2 Lê Lợi, Huế", Lat: 16.4631, Lng: 107.5882, Rating: 4.1, RatingCount: 112, Types: []string{"park"}},
		}
	}

	// Shopping queries
	if strings.Contains(q, "chợ") || strings.Contains(q, "mua sắm") || strings.Contains(q, "shopping") {
		return []PlaceResult{
			{PlaceID: "shop_1", Name: "Chợ Đông Ba", Address: "Trần Hưng Đạo, Huế", Lat: 16.4716, Lng: 107.5928, Rating: 4.2, RatingCount: 876, Types: []string{"shopping_mall", "market"}},
			{PlaceID: "shop_2", Name: "Chợ An Cựu", Address: "Hùng Vương, Huế", Lat: 16.4582, Lng: 107.5915, Rating: 4.0, RatingCount: 345, Types: []string{"market"}},
			{PlaceID: "shop_3", Name: "Vincom Plaza Huế", Address: "50A Hùng Vương, Huế", Lat: 16.4589, Lng: 107.5912, Rating: 4.3, RatingCount: 523, Types: []string{"shopping_mall", "store"}},
			{PlaceID: "shop_4", Name: "Phố đi bộ Nguyễn Đình Chiểu", Address: "Nguyễn Đình Chiểu, Huế", Lat: 16.4685, Lng: 107.5843, Rating: 4.4, RatingCount: 267, Types: []string{"store", "tourist_attraction"}},
		}
	}

	// Default: heritage / tourist attractions
	return []PlaceResult{
		{PlaceID: "heritage_1", Name: "Đại Nội Huế", Address: "Đường 23/8, Thuận Hoà, Huế", Lat: 16.4698, Lng: 107.5786, Rating: 4.7, RatingCount: 1523, Types: []string{"tourist_attraction", "museum"}},
		{PlaceID: "heritage_2", Name: "Chùa Thiên Mụ", Address: "Kim Long, Huế", Lat: 16.4539, Lng: 107.5534, Rating: 4.6, RatingCount: 987, Types: []string{"place_of_worship", "tourist_attraction"}},
		{PlaceID: "heritage_3", Name: "Lăng Tự Đức", Address: "Thủy Xuân, Huế", Lat: 16.4582, Lng: 107.5619, Rating: 4.5, RatingCount: 645, Types: []string{"tourist_attraction"}},
		{PlaceID: "heritage_4", Name: "Lăng Khải Định", Address: "Thủy Bằng, Hương Thủy", Lat: 16.4111, Lng: 107.5975, Rating: 4.5, RatingCount: 534, Types: []string{"tourist_attraction", "museum"}},
		{PlaceID: "heritage_5", Name: "Cầu Trường Tiền", Address: "Lê Lợi, Huế", Lat: 16.4643, Lng: 107.5843, Rating: 4.4, RatingCount: 1234, Types: []string{"tourist_attraction"}},
		{PlaceID: "heritage_6", Name: "Lăng Minh Mạng", Address: "Hương Thọ, Huế", Lat: 16.4267, Lng: 107.5518, Rating: 4.5, RatingCount: 489, Types: []string{"tourist_attraction"}},
	}
}


func (s *GoongPlacesService) mockDirection() *DirectionResult {
	return &DirectionResult{
		Distance:     "3.2 km",
		Duration:     "12 phút",
		DurationSecs: 720,
		StartAddress: "15 Lê Lợi, Huế",
		EndAddress:   "Đại Nội Huế",
		Steps: []Step{
			{Instruction: "Đi về phía Tây trên Lê Lợi", Distance: "500 m", Duration: "2 phút"},
			{Instruction: "Rẽ phải vào Trần Hưng Đạo", Distance: "1.2 km", Duration: "5 phút"},
			{Instruction: "Rẽ trái vào Đường 23/8", Distance: "1.5 km", Duration: "5 phút"},
		},
	}
}
