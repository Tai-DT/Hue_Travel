package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestCORS_IsOriginAllowed(t *testing.T) {
	allowedOrigins := []string{"http://localhost:3000", "http://localhost:8080"}

	// Valid exact match
	if !isOriginAllowed("http://localhost:3000", allowedOrigins) {
		t.Errorf("expected http://localhost:3000 to be allowed")
	}

	// Valid loopback/localhost parsing
	if !isOriginAllowed("http://localhost:19006", allowedOrigins) {
		t.Errorf("expected http://localhost:19006 to be allowed")
	}
	if !isOriginAllowed("http://127.0.0.1:8081", allowedOrigins) {
		t.Errorf("expected http://127.0.0.1:8081 to be allowed")
	}

	// Invalid origins attempting to bypass loopback check
	if isOriginAllowed("http://localhost.attacker.com", allowedOrigins) {
		t.Errorf("expected http://localhost.attacker.com to be blocked")
	}
	if isOriginAllowed("http://127.0.0.1.attacker.com", allowedOrigins) {
		t.Errorf("expected http://127.0.0.1.attacker.com to be blocked")
	}
	if isOriginAllowed("https://attacker.com", allowedOrigins) {
		t.Errorf("expected https://attacker.com to be blocked")
	}
}

func TestAPIVersion_SetsHeader(t *testing.T) {
	router := gin.New()
	router.Use(APIVersion("1.0.0"))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	version := w.Header().Get("X-API-Version")
	if version != "1.0.0" {
		t.Errorf("expected X-API-Version=1.0.0, got %q", version)
	}
}

func TestRequestID_GeneratesNew(t *testing.T) {
	router := gin.New()
	router.Use(RequestID())
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	reqID := w.Header().Get("X-Request-ID")
	if reqID == "" {
		t.Error("expected X-Request-ID to be set")
	}
}

func TestRequestID_UsesExisting(t *testing.T) {
	router := gin.New()
	router.Use(RequestID())
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Request-ID", "custom-id-123")
	router.ServeHTTP(w, req)

	reqID := w.Header().Get("X-Request-ID")
	if reqID != "custom-id-123" {
		t.Errorf("expected X-Request-ID=custom-id-123, got %q", reqID)
	}
}

func TestRecovery_CatchesPanic(t *testing.T) {
	router := gin.New()
	router.Use(Recovery())
	router.GET("/panic", func(c *gin.Context) {
		panic("test panic")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/panic", nil)

	// Should not panic
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", w.Code)
	}
}

func TestRateLimit_AllowsUnderLimit(t *testing.T) {
	router := gin.New()
	router.Use(RateLimit(5, 60_000_000_000)) // 5 per minute
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	for i := 0; i < 5; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		router.ServeHTTP(w, req)
		if w.Code != 200 {
			t.Errorf("request %d: expected 200, got %d", i+1, w.Code)
		}
	}
}

func TestRateLimit_BlocksOverLimit(t *testing.T) {
	router := gin.New()
	router.Use(RateLimit(2, 60_000_000_000)) // 2 per minute
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	// First 2 should pass
	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		router.ServeHTTP(w, req)
	}

	// Third should be rate-limited
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429, got %d", w.Code)
	}
}

func TestRequireRole_AllowsMatchingRole(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_role", "admin")
		c.Next()
	})
	router.Use(RequireRole("admin"))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestRequireRole_BlocksWrongRole(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_role", "traveler")
		c.Next()
	})
	router.Use(RequireRole("admin"))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestGenerateTokenWithType_ParsesClaims(t *testing.T) {
	userID := uuid.New()
	token, err := GenerateTokenWithType(userID, "traveler", TokenTypeRefresh, "secret", time.Hour)
	if err != nil {
		t.Fatalf("GenerateTokenWithType() error = %v", err)
	}

	claims, err := ParseToken(token, "secret")
	if err != nil {
		t.Fatalf("ParseToken() error = %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("expected userID %s, got %s", userID, claims.UserID)
	}
	if claims.Role != "traveler" {
		t.Errorf("expected role traveler, got %s", claims.Role)
	}
	if claims.Type != TokenTypeRefresh {
		t.Errorf("expected token type %s, got %s", TokenTypeRefresh, claims.Type)
	}
}

func TestAuth_RejectsRefreshToken(t *testing.T) {
	router := gin.New()
	router.Use(Auth("secret"))
	router.GET("/protected", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	token, err := GenerateTokenWithType(uuid.New(), "traveler", TokenTypeRefresh, "secret", time.Hour)
	if err != nil {
		t.Fatalf("GenerateTokenWithType() error = %v", err)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuth_AllowsAccessToken(t *testing.T) {
	router := gin.New()
	router.Use(Auth("secret"))
	router.GET("/protected", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	token, err := GenerateTokenWithType(uuid.New(), "traveler", TokenTypeAccess, "secret", time.Hour)
	if err != nil {
		t.Fatalf("GenerateTokenWithType() error = %v", err)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}
