package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ============================================
// Health Handler Tests
// ============================================

func TestHealthCheck(t *testing.T) {
	h := NewHealthHandler(nil, nil)
	router := gin.New()
	router.GET("/health", h.Check)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}

	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatal("expected 'data' field in response")
	}

	if data["status"] != "healthy" {
		t.Errorf("expected status=healthy, got %v", data["status"])
	}

	if data["service"] != "hue-travel-api" {
		t.Errorf("expected service=hue-travel-api, got %v", data["service"])
	}

	if data["version"] != "1.0.0" {
		t.Errorf("expected version=1.0.0, got %v", data["version"])
	}
}

// ============================================
// Auth Handler — Validation Tests
// ============================================

func TestAuthHandler_Register_MissingData(t *testing.T) {
	router := gin.New()
	h := &AuthHandler{}
	router.POST("/auth/register", h.Register)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/auth/register", nil)
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestAuthHandler_LoginWithPassword_MissingData(t *testing.T) {
	router := gin.New()
	h := &AuthHandler{}
	router.POST("/auth/login", h.LoginWithPassword)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/auth/login", nil)
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestAuthHandler_RefreshToken_MissingData(t *testing.T) {
	router := gin.New()
	h := &AuthHandler{}
	router.POST("/auth/refresh", h.RefreshToken)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/auth/refresh", nil)
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestAuthHandler_Me_NoAuth(t *testing.T) {
	router := gin.New()
	h := &AuthHandler{}
	router.GET("/me", h.Me)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/me", nil)
	router.ServeHTTP(w, req)

	// Should return 401 because no user_id in context
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", w.Code)
	}
}

// ============================================
// Response Format Tests
// ============================================

func TestResponseFormat_Success(t *testing.T) {
	router := gin.New()
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    gin.H{"message": "hello"},
		})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}

	if resp["success"] != true {
		t.Error("expected success=true")
	}

	if resp["data"] == nil {
		t.Error("expected data field")
	}
}

func TestResponseFormat_Error(t *testing.T) {
	router := gin.New()
	router.GET("/error", func(c *gin.Context) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   gin.H{"code": "ERR-001", "message": "test error"},
		})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/error", nil)
	router.ServeHTTP(w, req)

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}

	if resp["success"] != false {
		t.Error("expected success=false")
	}

	errObj, ok := resp["error"].(map[string]interface{})
	if !ok || errObj["code"] != "ERR-001" {
		t.Error("expected error code ERR-001")
	}
}
