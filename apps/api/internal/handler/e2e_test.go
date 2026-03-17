package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/huetravel/api/internal/middleware"
	"github.com/huetravel/api/internal/service"
)

// ============================================
// E2E-style Integration Tests
// Tests full request lifecycle through handlers
// ============================================

func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.APIVersion("1.0.0-test"))
	return r
}

// ============================================
// Health endpoint E2E
// ============================================

func TestE2E_HealthEndpoint(t *testing.T) {
	r := setupTestRouter()
	h := NewHealthHandler(nil, nil)
	r.GET("/health", h.Check)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	r.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	data := resp["data"].(map[string]interface{})
	if data["status"] == nil {
		t.Error("expected status field")
	}
	if data["version"] == nil {
		t.Error("expected version field")
	}
	if data["dependencies"] == nil {
		t.Error("expected dependencies field")
	}

	// Check API version header is set
	version := w.Header().Get("X-API-Version")
	if version != "1.0.0-test" {
		t.Errorf("expected X-API-Version=1.0.0-test, got %q", version)
	}

	// Check Request ID header is set
	reqID := w.Header().Get("X-Request-ID")
	if reqID == "" {
		t.Error("expected X-Request-ID header to be set")
	}
}

// ============================================
// Search endpoint E2E
// ============================================

func TestE2E_SearchEndpoint(t *testing.T) {
	r := setupTestRouter()
	searchSvc := service.NewSearchService("", "")
	searchH := NewSearchHandler(searchSvc)

	r.GET("/api/v1/search", searchH.Search)
	r.GET("/api/v1/search/suggest", searchH.Suggest)
	r.GET("/api/v1/search/trending", searchH.Trending)
	r.GET("/api/v1/search/stats", searchH.IndexStats)

	// Test search
	t.Run("search with query", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/search?q=Huế", nil)
		r.ServeHTTP(w, req)

		if w.Code != 200 {
			t.Fatalf("expected 200, got %d", w.Code)
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)

		data := resp["data"].(map[string]interface{})
		if data["total_count"] == nil {
			t.Error("expected total_count")
		}
	})

	// Test missing query
	t.Run("search without query returns 400", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/search", nil)
		r.ServeHTTP(w, req)

		if w.Code != 400 {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	// Test suggest
	t.Run("suggest", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/search/suggest?q=Đại", nil)
		r.ServeHTTP(w, req)

		if w.Code != 200 {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	// Test trending
	t.Run("trending", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/search/trending", nil)
		r.ServeHTTP(w, req)

		if w.Code != 200 {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	// Test stats
	t.Run("stats", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/search/stats", nil)
		r.ServeHTTP(w, req)

		if w.Code != 200 {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})
}

// ============================================
// AI endpoint E2E
// ============================================

func TestE2E_AIQuickSuggest(t *testing.T) {
	r := setupTestRouter()
	aiSvc := service.NewAITripPlannerService("")
	aiH := NewAIHandler(aiSvc)

	r.GET("/api/v1/ai/suggest", aiH.QuickSuggest)

	tests := []struct {
		name     string
		query    string
		wantCode int
	}{
		{"general suggestions", "?type=general", 200},
		{"food suggestions", "?type=food", 200},
		{"sightseeing", "?type=sightseeing", 200},
		{"unknown type fallback", "?type=unknown", 200},
		{"default", "", 200},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", "/api/v1/ai/suggest"+tt.query, nil)
			r.ServeHTTP(w, req)

			if w.Code != tt.wantCode {
				t.Errorf("expected %d, got %d", tt.wantCode, w.Code)
			}
		})
	}
}

// ============================================
// Auth validation E2E
// ============================================

func TestE2E_AuthValidation(t *testing.T) {
	r := setupTestRouter()
	authH := &AuthHandler{}

	r.POST("/api/v1/auth/register", authH.Register)
	r.POST("/api/v1/auth/login", authH.LoginWithPassword)

	t.Run("register without body", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/v1/auth/register", nil)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		if w.Code != 400 {
			t.Errorf("expected 400, got %d", w.Code)
		}
	})

	t.Run("login without body", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/v1/auth/login", nil)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		if w.Code != 400 {
			t.Errorf("expected 400, got %d", w.Code)
		}
	})
}

// ============================================
// Payment methods E2E
// ============================================

func TestE2E_PaymentMethods(t *testing.T) {
	r := setupTestRouter()
	vnpaySvc := service.NewVNPayService("", "", "", true)
	payH := NewPaymentHandler(vnpaySvc, nil, nil)

	r.GET("/api/v1/payment/methods", payH.PaymentMethods)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/payment/methods", nil)
	r.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	data := resp["data"].(map[string]interface{})
	methods := data["methods"].([]interface{})
	if len(methods) != 3 {
		t.Errorf("expected 3 payment methods, got %d", len(methods))
	}
}

// ============================================
// API docs E2E
// ============================================

func TestE2E_DocsEndpoint(t *testing.T) {
	r := setupTestRouter()
	docsH := NewDocsHandler()
	r.GET("/api/v1/docs", docsH.GetDocs)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/docs", nil)
	r.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	data := resp["data"].(map[string]interface{})
	if data["total"] == nil {
		t.Error("expected total endpoints count")
	}
	if data["categories"] == nil {
		t.Error("expected categories")
	}
}

// ============================================
// Response format E2E — all responses follow standard format
// ============================================

func TestE2E_StandardResponseFormat(t *testing.T) {
	r := setupTestRouter()
	h := NewHealthHandler(nil, nil)
	r.GET("/health", h.Check)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	r.ServeHTTP(w, req)

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	// All responses must have "success" field
	if _, ok := resp["success"]; !ok {
		t.Error("response must have 'success' field")
	}

	// Successful responses must have "data" field
	if _, ok := resp["data"]; !ok {
		t.Error("successful response must have 'data' field")
	}
}

// ============================================
// Recovery middleware E2E
// ============================================

func TestE2E_PanicRecovery(t *testing.T) {
	r := setupTestRouter()
	r.GET("/panic", func(c *gin.Context) {
		panic("intentional test panic")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/panic", nil)
	r.ServeHTTP(w, req)

	if w.Code != 500 {
		t.Fatalf("expected 500, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["success"] != false {
		t.Error("expected success=false on panic")
	}
}

// ============================================
// Notification handler mock E2E
// ============================================

func TestE2E_NotificationEndpoints(t *testing.T) {
	r := setupTestRouter()
	notifSvc := service.NewNotificationService("", nil)
	notifH := NewNotificationHandler(notifSvc, nil)

	// Simulate authenticated user via middleware on the engine
	authRouter := setupTestRouter()
	authRouter.Use(func(c *gin.Context) {
		c.Set("user_id", "550e8400-e29b-41d4-a716-446655440000")
		c.Next()
	})
	authRouter.GET("/api/v1/notifications", notifH.GetNotifications)
	authRouter.GET("/api/v1/notifications/unread", notifH.UnreadCount)
	authRouter.POST("/api/v1/notifications/:id/read", notifH.MarkRead)
	authRouter.POST("/api/v1/notifications/device", notifH.RegisterDevice)

	// Without auth — should return 401
	noAuthRouter := setupTestRouter()
	noAuthRouter.GET("/api/v1/notifications", notifH.GetNotifications)

	t.Run("get notifications without auth returns 401", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/notifications", nil)
		noAuthRouter.ServeHTTP(w, req)

		if w.Code != 401 {
			t.Errorf("expected 401, got %d", w.Code)
		}
	})

	_ = r // suppress unused
	_ = authRouter
}

func mustParseUUID(s string) interface{} {
	return s
}
