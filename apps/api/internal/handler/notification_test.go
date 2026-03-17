package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/huetravel/api/internal/service"
)

func TestNotificationHandlerGetNotificationsReturnsServiceUnavailableWhenMockDisabled(t *testing.T) {
	router := gin.New()
	h := NewNotificationHandler(service.NewNotificationService("", nil), nil, false)
	router.Use(func(c *gin.Context) {
		c.Set("user_id", uuid.MustParse("550e8400-e29b-41d4-a716-446655440000"))
		c.Next()
	})
	router.GET("/notifications", h.GetNotifications)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/notifications", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", w.Code)
	}
}

func TestNotificationHandlerUnreadCountReturnsServiceUnavailableWhenMockDisabled(t *testing.T) {
	router := gin.New()
	h := NewNotificationHandler(service.NewNotificationService("", nil), nil, false)
	router.Use(func(c *gin.Context) {
		c.Set("user_id", uuid.MustParse("550e8400-e29b-41d4-a716-446655440000"))
		c.Next()
	})
	router.GET("/notifications/unread", h.UnreadCount)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/notifications/unread", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", w.Code)
	}
}
