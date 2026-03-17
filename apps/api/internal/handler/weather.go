package handler

import (
	"errors"

	"github.com/gin-gonic/gin"

	"github.com/huetravel/api/internal/service"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Weather Handler
// ============================================

type WeatherHandler struct {
	weatherSvc *service.WeatherService
}

func NewWeatherHandler(svc *service.WeatherService) *WeatherHandler {
	return &WeatherHandler{weatherSvc: svc}
}

// GetCurrent — thời tiết hiện tại ở Huế
func (h *WeatherHandler) GetCurrent(c *gin.Context) {
	weather, err := h.weatherSvc.GetCurrentWeather()
	if err != nil {
		if errors.Is(err, service.ErrServiceNotConfigured) || errors.Is(err, service.ErrServiceUnavailable) {
			response.ServiceUnavailable(c, "HT-WEATHER-001", "Dịch vụ thời tiết hiện chưa sẵn sàng")
			return
		}
		response.InternalError(c, "Không thể lấy thời tiết")
		return
	}
	response.OK(c, gin.H{"weather": weather})
}

// GetForecast — dự báo thời tiết 7 ngày
func (h *WeatherHandler) GetForecast(c *gin.Context) {
	forecast, err := h.weatherSvc.GetForecast()
	if err != nil {
		if errors.Is(err, service.ErrServiceNotConfigured) || errors.Is(err, service.ErrServiceUnavailable) {
			response.ServiceUnavailable(c, "HT-WEATHER-002", "Dịch vụ dự báo thời tiết hiện chưa sẵn sàng")
			return
		}
		response.InternalError(c, "Không thể lấy dự báo")
		return
	}

	if forecast == nil {
		forecast = []service.ForecastDay{}
	}
	response.OK(c, gin.H{
		"forecast": forecast,
		"total":    len(forecast),
	})
}

// GetBestTime — thời điểm tốt nhất để du lịch Huế
func (h *WeatherHandler) GetBestTime(c *gin.Context) {
	info := h.weatherSvc.GetBestTimeToVisit()
	response.OK(c, gin.H{"best_time": info})
}
