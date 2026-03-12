package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// ============================================
// Google Places Service
// ============================================

type GooglePlacesService struct {
	apiKey     string
	httpClient *http.Client
}

func NewGooglePlacesService(apiKey string) *GooglePlacesService {
	return &GooglePlacesService{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// HasAPIKey checks if API key is configured
func (s *GooglePlacesService) HasAPIKey() bool {
	return s.apiKey != "" && s.apiKey != "your_google_maps_api_key"
}

// PlaceResult represents a Google Places API result
type PlaceResult struct {
	PlaceID          string   `json:"place_id"`
	Name             string   `json:"name"`
	Address          string   `json:"address"`
	Lat              float64  `json:"lat"`
	Lng              float64  `json:"lng"`
	Rating           float64  `json:"rating"`
	RatingCount      int      `json:"rating_count"`
	PriceLevel       int      `json:"price_level"`
	Types            []string `json:"types"`
	OpenNow          *bool    `json:"open_now,omitempty"`
	PhotoReference   string   `json:"photo_reference,omitempty"`
	PhotoURL         string   `json:"photo_url,omitempty"`
}

// DirectionResult represents directions between two points
type DirectionResult struct {
	Distance     string    `json:"distance"`
	Duration     string    `json:"duration"`
	DurationSecs int       `json:"duration_secs"`
	StartAddress string    `json:"start_address"`
	EndAddress   string    `json:"end_address"`
	Steps        []Step    `json:"steps"`
	Polyline     string    `json:"polyline"`
}

type Step struct {
	Instruction string  `json:"instruction"`
	Distance    string  `json:"distance"`
	Duration    string  `json:"duration"`
	StartLat    float64 `json:"start_lat"`
	StartLng    float64 `json:"start_lng"`
	EndLat      float64 `json:"end_lat"`
	EndLng      float64 `json:"end_lng"`
}

// ============================================
// Nearby Search — tìm quán ăn/điểm gần đây
// ============================================

func (s *GooglePlacesService) NearbySearch(ctx context.Context, lat, lng float64, radius int, placeType string) ([]PlaceResult, error) {
	if !s.HasAPIKey() {
		return s.mockNearbyResults(), nil
	}

	params := url.Values{}
	params.Set("location", fmt.Sprintf("%f,%f", lat, lng))
	params.Set("radius", fmt.Sprintf("%d", radius))
	params.Set("type", placeType)
	params.Set("language", "vi")
	params.Set("key", s.apiKey)

	apiURL := "https://maps.googleapis.com/maps/api/place/nearbysearch/json?" + params.Encode()

	resp, err := s.httpClient.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("google places API error: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Results []struct {
			PlaceID  string `json:"place_id"`
			Name     string `json:"name"`
			Vicinity string `json:"vicinity"`
			Geometry struct {
				Location struct {
					Lat float64 `json:"lat"`
					Lng float64 `json:"lng"`
				} `json:"location"`
			} `json:"geometry"`
			Rating           float64  `json:"rating"`
			UserRatingsTotal int      `json:"user_ratings_total"`
			PriceLevel       int      `json:"price_level"`
			Types            []string `json:"types"`
			OpeningHours     *struct {
				OpenNow bool `json:"open_now"`
			} `json:"opening_hours"`
			Photos []struct {
				PhotoReference string `json:"photo_reference"`
			} `json:"photos"`
		} `json:"results"`
		Status string `json:"status"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse error: %w", err)
	}

	var places []PlaceResult
	for _, r := range result.Results {
		p := PlaceResult{
			PlaceID:     r.PlaceID,
			Name:        r.Name,
			Address:     r.Vicinity,
			Lat:         r.Geometry.Location.Lat,
			Lng:         r.Geometry.Location.Lng,
			Rating:      r.Rating,
			RatingCount: r.UserRatingsTotal,
			PriceLevel:  r.PriceLevel,
			Types:       r.Types,
		}
		if r.OpeningHours != nil {
			open := r.OpeningHours.OpenNow
			p.OpenNow = &open
		}
		if len(r.Photos) > 0 {
			p.PhotoReference = r.Photos[0].PhotoReference
			p.PhotoURL = s.GetPhotoURL(r.Photos[0].PhotoReference, 400)
		}
		places = append(places, p)
	}

	return places, nil
}

// ============================================
// Text Search — tìm kiếm bằng text
// ============================================

func (s *GooglePlacesService) TextSearch(ctx context.Context, query string, lat, lng float64) ([]PlaceResult, error) {
	if !s.HasAPIKey() {
		return s.mockSearchResults(query), nil
	}

	params := url.Values{}
	params.Set("query", query+" Huế")
	params.Set("location", fmt.Sprintf("%f,%f", lat, lng))
	params.Set("radius", "10000")
	params.Set("language", "vi")
	params.Set("key", s.apiKey)

	apiURL := "https://maps.googleapis.com/maps/api/place/textsearch/json?" + params.Encode()

	resp, err := s.httpClient.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("google places API error: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Results []struct {
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
			Photos           []struct {
				PhotoReference string `json:"photo_reference"`
			} `json:"photos"`
		} `json:"results"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse error: %w", err)
	}

	var places []PlaceResult
	for _, r := range result.Results {
		p := PlaceResult{
			PlaceID:     r.PlaceID,
			Name:        r.Name,
			Address:     r.FormattedAddress,
			Lat:         r.Geometry.Location.Lat,
			Lng:         r.Geometry.Location.Lng,
			Rating:      r.Rating,
			RatingCount: r.UserRatingsTotal,
			PriceLevel:  r.PriceLevel,
			Types:       r.Types,
		}
		if len(r.Photos) > 0 {
			p.PhotoReference = r.Photos[0].PhotoReference
			p.PhotoURL = s.GetPhotoURL(r.Photos[0].PhotoReference, 400)
		}
		places = append(places, p)
	}

	return places, nil
}

// ============================================
// Directions — lấy đường đi
// ============================================

func (s *GooglePlacesService) GetDirections(ctx context.Context, originLat, originLng, destLat, destLng float64, mode string) (*DirectionResult, error) {
	if !s.HasAPIKey() {
		return s.mockDirection(), nil
	}

	if mode == "" {
		mode = "driving"
	}

	params := url.Values{}
	params.Set("origin", fmt.Sprintf("%f,%f", originLat, originLng))
	params.Set("destination", fmt.Sprintf("%f,%f", destLat, destLng))
	params.Set("mode", mode)
	params.Set("language", "vi")
	params.Set("key", s.apiKey)

	apiURL := "https://maps.googleapis.com/maps/api/directions/json?" + params.Encode()

	resp, err := s.httpClient.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("directions API error: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

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
					HTMLInstructions string `json:"html_instructions"`
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
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse error: %w", err)
	}

	if len(result.Routes) == 0 || len(result.Routes[0].Legs) == 0 {
		return nil, fmt.Errorf("no route found")
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

	for _, s := range leg.Steps {
		dir.Steps = append(dir.Steps, Step{
			Instruction: s.HTMLInstructions,
			Distance:    s.Distance.Text,
			Duration:    s.Duration.Text,
			StartLat:    s.StartLocation.Lat,
			StartLng:    s.StartLocation.Lng,
			EndLat:      s.EndLocation.Lat,
			EndLng:      s.EndLocation.Lng,
		})
	}

	return dir, nil
}

// GetPhotoURL returns a photo URL from reference
func (s *GooglePlacesService) GetPhotoURL(ref string, maxWidth int) string {
	return fmt.Sprintf(
		"https://maps.googleapis.com/maps/api/place/photo?maxwidth=%d&photo_reference=%s&key=%s",
		maxWidth, ref, s.apiKey,
	)
}

// ============================================
// Mock Data (khi chưa có API key)
// ============================================

func (s *GooglePlacesService) mockNearbyResults() []PlaceResult {
	return []PlaceResult{
		{PlaceID: "mock_1", Name: "Bún Bò Huế Bà Tuyết", Address: "47 Nguyễn Công Trứ, Huế", Lat: 16.4637, Lng: 107.5909, Rating: 4.5, RatingCount: 234, PriceLevel: 1, Types: []string{"restaurant"}},
		{PlaceID: "mock_2", Name: "Cơm Hến Bà Oanh", Address: "2 Hàn Mặc Tử, Huế", Lat: 16.4712, Lng: 107.5801, Rating: 4.3, RatingCount: 156, PriceLevel: 1, Types: []string{"restaurant"}},
		{PlaceID: "mock_3", Name: "Bánh Khoái Lạc Thiện", Address: "6 Đinh Tiên Hoàng, Huế", Lat: 16.4678, Lng: 107.5859, Rating: 4.4, RatingCount: 312, PriceLevel: 1, Types: []string{"restaurant"}},
		{PlaceID: "mock_4", Name: "Quán Chè Hẻm", Address: "1 Hùng Vương, Huế", Lat: 16.4601, Lng: 107.5882, Rating: 4.6, RatingCount: 89, PriceLevel: 1, Types: []string{"cafe"}},
		{PlaceID: "mock_5", Name: "Nem Lụi Bà Đào", Address: "23 Nguyễn Thái Học, Huế", Lat: 16.4655, Lng: 107.5845, Rating: 4.2, RatingCount: 178, PriceLevel: 1, Types: []string{"restaurant"}},
	}
}

func (s *GooglePlacesService) mockSearchResults(query string) []PlaceResult {
	return []PlaceResult{
		{PlaceID: "search_1", Name: "Đại Nội Huế", Address: "Đường 23/8, Thuận Hoà, Huế", Lat: 16.4698, Lng: 107.5786, Rating: 4.7, RatingCount: 1523, Types: []string{"tourist_attraction"}},
		{PlaceID: "search_2", Name: "Chùa Thiên Mụ", Address: "Kim Long, Huế", Lat: 16.4539, Lng: 107.5534, Rating: 4.6, RatingCount: 987, Types: []string{"place_of_worship"}},
		{PlaceID: "search_3", Name: "Lăng Tự Đức", Address: "Thủy Xuân, Huế", Lat: 16.4582, Lng: 107.5619, Rating: 4.5, RatingCount: 645, Types: []string{"tourist_attraction"}},
	}
}

func (s *GooglePlacesService) mockDirection() *DirectionResult {
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
