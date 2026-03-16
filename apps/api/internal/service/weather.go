package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ============================================
// Weather Service — Thời tiết Huế
// ============================================

const (
	hueLat = 16.4637
	hueLng = 107.5909
)

type WeatherService struct {
	apiKey string
}

func NewWeatherService(apiKey string) *WeatherService {
	return &WeatherService{apiKey: apiKey}
}

type CurrentWeather struct {
	Temperature float64 `json:"temperature"`
	FeelsLike   float64 `json:"feels_like"`
	TempMin     float64 `json:"temp_min"`
	TempMax     float64 `json:"temp_max"`
	Humidity    int     `json:"humidity"`
	WindSpeed   float64 `json:"wind_speed"`
	Description string  `json:"description"`
	Icon        string  `json:"icon"`
	IconURL     string  `json:"icon_url"`
	Condition   string  `json:"condition"`
	Visibility  int     `json:"visibility"`
	Pressure    int     `json:"pressure"`
	Location    string  `json:"location"`
	UpdatedAt   string  `json:"updated_at"`
}

type ForecastDay struct {
	Date        string  `json:"date"`
	TempMin     float64 `json:"temp_min"`
	TempMax     float64 `json:"temp_max"`
	Humidity    int     `json:"humidity"`
	Description string  `json:"description"`
	Icon        string  `json:"icon"`
	IconURL     string  `json:"icon_url"`
	Condition   string  `json:"condition"`
	WindSpeed   float64 `json:"wind_speed"`
	RainChance  float64 `json:"rain_chance"`
}

type BestTimeInfo struct {
	BestMonths  []string `json:"best_months"`
	AvoidMonths []string `json:"avoid_months"`
	CurrentTip  string   `json:"current_tip"`
	Seasons     []Season `json:"seasons"`
}

type Season struct {
	Name        string `json:"name"`
	Months      string `json:"months"`
	Temperature string `json:"temperature"`
	Description string `json:"description"`
	Rating      int    `json:"rating"` // 1-5 stars
}

// GetCurrentWeather — thời tiết hiện tại ở Huế
func (s *WeatherService) GetCurrentWeather() (*CurrentWeather, error) {
	if s.apiKey == "" {
		return s.getMockWeather(), nil
	}

	url := fmt.Sprintf(
		"https://api.openweathermap.org/data/2.5/weather?lat=%f&lon=%f&appid=%s&units=metric&lang=vi",
		hueLat, hueLng, s.apiKey,
	)

	resp, err := http.Get(url)
	if err != nil {
		return s.getMockWeather(), nil
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return s.getMockWeather(), nil
	}

	weather := &CurrentWeather{
		Location:  "Huế, Thừa Thiên Huế",
		UpdatedAt: time.Now().Format(time.RFC3339),
	}

	if main, ok := data["main"].(map[string]interface{}); ok {
		weather.Temperature = toFloat(main["temp"])
		weather.FeelsLike = toFloat(main["feels_like"])
		weather.TempMin = toFloat(main["temp_min"])
		weather.TempMax = toFloat(main["temp_max"])
		weather.Humidity = int(toFloat(main["humidity"]))
		weather.Pressure = int(toFloat(main["pressure"]))
	}

	if wind, ok := data["wind"].(map[string]interface{}); ok {
		weather.WindSpeed = toFloat(wind["speed"])
	}

	if visibility, ok := data["visibility"].(float64); ok {
		weather.Visibility = int(visibility)
	}

	if weatherArr, ok := data["weather"].([]interface{}); ok && len(weatherArr) > 0 {
		w := weatherArr[0].(map[string]interface{})
		weather.Description = fmt.Sprint(w["description"])
		weather.Condition = fmt.Sprint(w["main"])
		weather.Icon = fmt.Sprint(w["icon"])
		weather.IconURL = fmt.Sprintf("https://openweathermap.org/img/wn/%s@2x.png", weather.Icon)
	}

	return weather, nil
}

// GetForecast — dự báo 7 ngày
func (s *WeatherService) GetForecast() ([]ForecastDay, error) {
	if s.apiKey == "" {
		return s.getMockForecast(), nil
	}

	url := fmt.Sprintf(
		"https://api.openweathermap.org/data/2.5/forecast?lat=%f&lon=%f&appid=%s&units=metric&lang=vi",
		hueLat, hueLng, s.apiKey,
	)

	resp, err := http.Get(url)
	if err != nil {
		return s.getMockForecast(), nil
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return s.getMockForecast(), nil
	}

	dailyMap := make(map[string]*ForecastDay)
	if list, ok := data["list"].([]interface{}); ok {
		for _, item := range list {
			entry := item.(map[string]interface{})
			dt := fmt.Sprint(entry["dt_txt"])
			date := dt[:10]

			if _, exists := dailyMap[date]; !exists {
				dailyMap[date] = &ForecastDay{
					Date:    date,
					TempMin: 999,
					TempMax: -999,
				}
			}

			day := dailyMap[date]
			if main, ok := entry["main"].(map[string]interface{}); ok {
				tempMin := toFloat(main["temp_min"])
				tempMax := toFloat(main["temp_max"])
				humidity := int(toFloat(main["humidity"]))
				if tempMin < day.TempMin {
					day.TempMin = tempMin
				}
				if tempMax > day.TempMax {
					day.TempMax = tempMax
				}
				day.Humidity = humidity
			}

			if wind, ok := entry["wind"].(map[string]interface{}); ok {
				day.WindSpeed = toFloat(wind["speed"])
			}

			if weatherArr, ok := entry["weather"].([]interface{}); ok && len(weatherArr) > 0 {
				w := weatherArr[0].(map[string]interface{})
				day.Description = fmt.Sprint(w["description"])
				day.Condition = fmt.Sprint(w["main"])
				day.Icon = fmt.Sprint(w["icon"])
				day.IconURL = fmt.Sprintf("https://openweathermap.org/img/wn/%s@2x.png", day.Icon)
			}

			if rain, ok := entry["pop"].(float64); ok {
				day.RainChance = rain * 100
			}
		}
	}

	var forecast []ForecastDay
	for _, day := range dailyMap {
		forecast = append(forecast, *day)
	}
	return forecast, nil
}

// GetBestTimeToVisit — thời điểm tốt nhất để du lịch Huế
func (s *WeatherService) GetBestTimeToVisit() *BestTimeInfo {
	month := time.Now().Month()
	var tip string

	switch {
	case month >= 2 && month <= 4:
		tip = "🌸 Thời điểm tuyệt vời! Thời tiết mát mẻ, ít mưa. Hãy tận hưởng mùa xuân Huế."
	case month >= 5 && month <= 8:
		tip = "☀️ Mùa hè nóng nhưng sôi động. Nhớ mang kem chống nắng và uống nhiều nước!"
	case month >= 9 && month <= 11:
		tip = "🌧️ Mùa mưa ở Huế. Mang áo mưa, nhưng Huế trong mưa cũng rất thơ."
	default:
		tip = "❄️ Mùa đông se lạnh. Thời tiết dễ chịu để tham quan các di tích."
	}

	return &BestTimeInfo{
		BestMonths:  []string{"Tháng 2", "Tháng 3", "Tháng 4", "Tháng 12", "Tháng 1"},
		AvoidMonths: []string{"Tháng 9", "Tháng 10", "Tháng 11"},
		CurrentTip:  tip,
		Seasons: []Season{
			{Name: "Xuân 🌸", Months: "Tháng 2 - 4", Temperature: "20-28°C", Description: "Thời tiết lý tưởng, hoa nở khắp thành phố", Rating: 5},
			{Name: "Hạ ☀️", Months: "Tháng 5 - 8", Temperature: "28-38°C", Description: "Nóng, nhiều nắng, biển Thuận An tuyệt vời", Rating: 3},
			{Name: "Thu 🌧️", Months: "Tháng 9 - 11", Temperature: "22-30°C", Description: "Mùa mưa, lũ có thể xảy ra tháng 10-11", Rating: 2},
			{Name: "Đông ❄️", Months: "Tháng 12 - 1", Temperature: "16-24°C", Description: "Se lạnh, sương mù tạo vẻ đẹp cổ kính", Rating: 4},
		},
	}
}

func (s *WeatherService) getMockWeather() *CurrentWeather {
	return &CurrentWeather{
		Temperature: 28.5,
		FeelsLike:   31.2,
		TempMin:     25.0,
		TempMax:     33.0,
		Humidity:    75,
		WindSpeed:   3.5,
		Description: "trời nắng",
		Icon:        "01d",
		IconURL:     "https://openweathermap.org/img/wn/01d@2x.png",
		Condition:   "Clear",
		Visibility:  10000,
		Pressure:    1010,
		Location:    "Huế, Thừa Thiên Huế",
		UpdatedAt:   time.Now().Format(time.RFC3339),
	}
}

func (s *WeatherService) getMockForecast() []ForecastDay {
	var days []ForecastDay
	now := time.Now()
	conditions := []struct{ desc, cond, icon string }{
		{"trời nắng", "Clear", "01d"},
		{"mây rải rác", "Clouds", "02d"},
		{"mưa nhẹ", "Rain", "10d"},
		{"trời nắng", "Clear", "01d"},
		{"nhiều mây", "Clouds", "03d"},
		{"mưa rào", "Rain", "09d"},
		{"trời nắng", "Clear", "01d"},
	}
	for i := 0; i < 7; i++ {
		c := conditions[i%len(conditions)]
		days = append(days, ForecastDay{
			Date:        now.AddDate(0, 0, i).Format("2006-01-02"),
			TempMin:     24 + float64(i%3),
			TempMax:     32 + float64(i%4),
			Humidity:    70 + i*2,
			Description: c.desc,
			Condition:   c.cond,
			Icon:        c.icon,
			IconURL:     fmt.Sprintf("https://openweathermap.org/img/wn/%s@2x.png", c.icon),
			WindSpeed:   2.5 + float64(i)*0.5,
			RainChance:  float64(i*10 + 10),
		})
	}
	return days
}

func toFloat(v interface{}) float64 {
	if f, ok := v.(float64); ok {
		return f
	}
	return 0
}
