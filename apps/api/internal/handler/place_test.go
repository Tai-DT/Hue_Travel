package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/huetravel/api/internal/service"
)

func TestPlaceHandlerReturnsServiceUnavailableWhenStrictPlacesAreNotConfigured(t *testing.T) {
	router := gin.New()
	h := NewPlaceHandler(service.NewGoongPlacesServiceWithFallback("", false))

	router.GET("/places/search", h.Search)
	router.GET("/places/nearby", h.NearbyRestaurants)
	router.GET("/places/directions", h.GetDirections)

	t.Run("search", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/places/search?q=Đại Nội", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected status 503, got %d", w.Code)
		}
	})

	t.Run("nearby", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/places/nearby?lat=16.4637&lng=107.5909", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected status 503, got %d", w.Code)
		}
	})

	t.Run("directions", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/places/directions?origin=16.4637,107.5909&destination=16.4698,107.5786", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected status 503, got %d", w.Code)
		}
	})
}
