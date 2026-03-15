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
	return []PlaceResult{
		{PlaceID: "search_1", Name: "Đại Nội Huế", Address: "Đường 23/8, Thuận Hoà, Huế", Lat: 16.4698, Lng: 107.5786, Rating: 4.7, RatingCount: 1523, Types: []string{"tourist_attraction"}},
		{PlaceID: "search_2", Name: "Chùa Thiên Mụ", Address: "Kim Long, Huế", Lat: 16.4539, Lng: 107.5534, Rating: 4.6, RatingCount: 987, Types: []string{"place_of_worship"}},
		{PlaceID: "search_3", Name: "Lăng Tự Đức", Address: "Thủy Xuân, Huế", Lat: 16.4582, Lng: 107.5619, Rating: 4.5, RatingCount: 645, Types: []string{"tourist_attraction"}},
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
