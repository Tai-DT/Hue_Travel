package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// CORS Middleware — Environment-aware
// ============================================

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		allowedOrigins := getAllowedOrigins()

		// Check if origin is allowed
		allowed := false
		for _, ao := range allowedOrigins {
			if ao == "*" || ao == origin {
				allowed = true
				break
			}
		}

		if allowed && origin != "" {
			c.Header("Access-Control-Allow-Origin", origin)
		} else if len(allowedOrigins) > 0 && allowedOrigins[0] == "*" {
			// Development mode fallback
			c.Header("Access-Control-Allow-Origin", "*")
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Request-ID")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")
		c.Header("Vary", "Origin")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// getAllowedOrigins returns allowed CORS origins based on environment
func getAllowedOrigins() []string {
	env := os.Getenv("APP_ENV")

	// Check for explicit CORS_ORIGINS env var first
	if origins := os.Getenv("CORS_ORIGINS"); origins != "" {
		return strings.Split(origins, ",")
	}

	// Environment-based defaults
	switch env {
	case "production":
		return []string{
			"https://huetravel.vn",
			"https://admin.huetravel.vn",
			"https://provider.huetravel.vn",
		}
	case "staging":
		return []string{
			"https://staging.huetravel.vn",
			"https://staging-admin.huetravel.vn",
		}
	default: // development
		return []string{
			"http://localhost:3000",
			"http://localhost:3001",
			"http://localhost:8080",
			"http://localhost:19006", // Expo web
		}
	}
}

// ============================================
// Request ID Middleware
// ============================================

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// ============================================
// Logger Middleware
// ============================================

func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		latency := time.Since(start)
		statusCode := c.Writer.Status()
		requestID, _ := c.Get("request_id")

		reqIDStr := ""
		if requestID != nil {
			reqIDStr = requestID.(string)
		}

		gin.DefaultWriter.Write([]byte(
			time.Now().Format(time.RFC3339) +
				" | " + c.Request.Method +
				" | " + path +
				" | " + http.StatusText(statusCode) +
				" | " + latency.String() +
				" | " + reqIDStr + "\n",
		))
	}
}

// ============================================
// JWT Auth Middleware
// ============================================

type JWTClaims struct {
	UserID uuid.UUID `json:"user_id"`
	Role   string    `json:"role"`
	jwt.RegisteredClaims
}

func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "Token không được cung cấp")
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenStr == authHeader {
			response.Unauthorized(c, "Token format không hợp lệ")
			c.Abort()
			return
		}

		claims, err := parseToken(tokenStr, jwtSecret)
		if err != nil {
			response.Unauthorized(c, "Token không hợp lệ hoặc đã hết hạn")
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("user_role", claims.Role)
		c.Next()
	}
}

// WebSocketAuth extracts JWT from the "token" query parameter or
// Sec-WebSocket-Protocol header for WebSocket connections.
// This is more secure than passing user_id directly in query params.
func WebSocketAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenStr string

		// Priority 1: Authorization header (if client supports it)
		if authHeader := c.GetHeader("Authorization"); authHeader != "" {
			tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// Priority 2: "token" query parameter
		if tokenStr == "" {
			tokenStr = c.Query("token")
		}

		// Priority 3: Sec-WebSocket-Protocol header
		if tokenStr == "" {
			protocols := c.GetHeader("Sec-WebSocket-Protocol")
			for _, p := range strings.Split(protocols, ",") {
				p = strings.TrimSpace(p)
				if strings.HasPrefix(p, "access_token.") {
					tokenStr = strings.TrimPrefix(p, "access_token.")
					// Echo the protocol back so the handshake succeeds
					c.Header("Sec-WebSocket-Protocol", p)
					break
				}
			}
		}

		if tokenStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Token xác thực không được cung cấp. Gửi token qua query param 'token' hoặc header Authorization.",
			})
			c.Abort()
			return
		}

		claims, err := parseToken(tokenStr, jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token không hợp lệ hoặc đã hết hạn"})
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("user_role", claims.Role)
		c.Next()
	}
}

// parseToken validates a JWT token string and returns the claims
func parseToken(tokenStr, jwtSecret string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		return nil, fmt.Errorf("invalid claims")
	}

	return claims, nil
}

// RequireRole — Check user role
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists {
			response.Unauthorized(c, "Chưa xác thực")
			c.Abort()
			return
		}

		for _, role := range roles {
			if userRole.(string) == role {
				c.Next()
				return
			}
		}

		response.Forbidden(c, "Bạn không có quyền truy cập")
		c.Abort()
	}
}

// GenerateToken — Tạo JWT token
func GenerateToken(userID uuid.UUID, role string, secret string, expiry time.Duration) (string, error) {
	claims := JWTClaims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "hue-travel",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ============================================
// Rate Limiting Middleware — Thread-safe
// Uses per-IP mutex to prevent race conditions
// ============================================

type rateLimitEntry struct {
	mu      sync.Mutex
	count   int
	resetAt time.Time
}

func RateLimit(maxRequests int, window time.Duration) gin.HandlerFunc {
	var clients sync.Map

	// Cleanup goroutine — remove expired entries
	go func() {
		ticker := time.NewTicker(window)
		defer ticker.Stop()
		for range ticker.C {
			now := time.Now()
			clients.Range(func(key, value interface{}) bool {
				entry := value.(*rateLimitEntry)
				entry.mu.Lock()
				expired := now.After(entry.resetAt)
				entry.mu.Unlock()
				if expired {
					clients.Delete(key)
				}
				return true
			})
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		val, _ := clients.LoadOrStore(ip, &rateLimitEntry{
			count:   0,
			resetAt: now.Add(window),
		})
		entry := val.(*rateLimitEntry)

		// Lock per-IP entry to prevent race condition
		entry.mu.Lock()
		if now.After(entry.resetAt) {
			entry.count = 0
			entry.resetAt = now.Add(window)
		}
		entry.count++
		currentCount := entry.count
		remaining := maxRequests - currentCount
		resetAt := entry.resetAt
		entry.mu.Unlock()

		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", maxRequests))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", max(0, remaining)))
		c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", resetAt.Unix()))

		if currentCount > maxRequests {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "HT-RATE-001",
					"message": "Quá nhiều request. Vui lòng thử lại sau.",
				},
			})
			return
		}

		c.Next()
	}
}

// ============================================
// Recovery Middleware — Panic Handler
// ============================================

func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				requestID, _ := c.Get("request_id")
				reqIDStr := ""
				if requestID != nil {
					reqIDStr = requestID.(string)
				}
				fmt.Printf("🔥 PANIC [%s] %s %s: %v\n",
					reqIDStr, c.Request.Method, c.Request.URL.Path, err)

				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error": gin.H{
						"code":    "HT-SYS-500",
						"message": "Lỗi hệ thống. Vui lòng thử lại.",
					},
				})
			}
		}()
		c.Next()
	}
}
