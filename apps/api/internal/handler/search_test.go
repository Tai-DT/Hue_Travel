package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/huetravel/api/internal/service"
)

func TestSearchHandlerSuggestReturnsServiceUnavailableWhenStrictSearchIsNotConfigured(t *testing.T) {
	router := gin.New()
	h := NewSearchHandler(service.NewSearchServiceWithFallback("", "", false))
	router.GET("/search/suggest", h.Suggest)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/search/suggest?q=Hue", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", w.Code)
	}
}

func TestSearchHandlerTrendingReturnsServiceUnavailableWhenStrictSearchIsNotConfigured(t *testing.T) {
	router := gin.New()
	h := NewSearchHandler(service.NewSearchServiceWithFallback("", "", false))
	router.GET("/search/trending", h.Trending)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/search/trending", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", w.Code)
	}
}

func TestSearchHandlerStatsReturnsServiceUnavailableWhenStrictSearchIsNotConfigured(t *testing.T) {
	router := gin.New()
	h := NewSearchHandler(service.NewSearchServiceWithFallback("", "", false))
	router.GET("/search/stats", h.IndexStats)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/search/stats", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", w.Code)
	}
}
