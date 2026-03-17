package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/huetravel/api/internal/service"
)

func TestAIHandlerQuickSuggestReturnsServiceUnavailableWhenFallbackDisabledAndNoAPIKey(t *testing.T) {
	router := gin.New()
	h := NewAIHandler(service.NewAITripPlannerServiceWithFallback("", false))
	router.GET("/ai/suggest", h.QuickSuggest)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/ai/suggest?type=general", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", w.Code)
	}
}

func TestAIHandlerQuickSuggestReturnsStaticSuggestionsWhenFallbackEnabledAndNoAPIKey(t *testing.T) {
	router := gin.New()
	h := NewAIHandler(service.NewAITripPlannerServiceWithFallback("", true))
	router.GET("/ai/suggest", h.QuickSuggest)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/ai/suggest?type=general", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
}
