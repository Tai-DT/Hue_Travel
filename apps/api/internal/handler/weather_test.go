package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/huetravel/api/internal/service"
)

func TestWeatherHandlerGetCurrentReturnsServiceUnavailableWhenWeatherIsStrictAndUnconfigured(t *testing.T) {
	router := gin.New()
	h := NewWeatherHandler(service.NewWeatherServiceWithFallback("", false))
	router.GET("/weather/current", h.GetCurrent)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/weather/current", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", w.Code)
	}
}

func TestWeatherHandlerGetForecastReturnsServiceUnavailableWhenWeatherIsStrictAndUnconfigured(t *testing.T) {
	router := gin.New()
	h := NewWeatherHandler(service.NewWeatherServiceWithFallback("", false))
	router.GET("/weather/forecast", h.GetForecast)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/weather/forecast", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", w.Code)
	}
}
