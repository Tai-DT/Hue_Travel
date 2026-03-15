package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Health Handler — Detailed health check
// ============================================

type HealthHandler struct {
	pool *pgxpool.Pool
	rdb  *redis.Client
}

func NewHealthHandler(pool *pgxpool.Pool, rdb *redis.Client) *HealthHandler {
	return &HealthHandler{pool: pool, rdb: rdb}
}

func (h *HealthHandler) Check(c *gin.Context) {
	overall := "healthy"
	deps := []gin.H{}

	// Check PostgreSQL
	if h.pool != nil {
		start := time.Now()
		err := h.pool.Ping(c.Request.Context())
		latency := time.Since(start).Milliseconds()
		status := "connected"
		if err != nil {
			status = "error"
			overall = "degraded"
		}
		deps = append(deps, gin.H{
			"name": "postgresql", "status": status, "latency_ms": latency,
		})
	} else {
		deps = append(deps, gin.H{
			"name": "postgresql", "status": "not_configured", "latency_ms": 0,
		})
	}

	// Check Redis
	if h.rdb != nil {
		start := time.Now()
		err := h.rdb.Ping(c.Request.Context()).Err()
		latency := time.Since(start).Milliseconds()
		status := "connected"
		if err != nil {
			status = "error"
			overall = "degraded"
		}
		deps = append(deps, gin.H{
			"name": "redis", "status": status, "latency_ms": latency,
		})
	} else {
		deps = append(deps, gin.H{
			"name": "redis", "status": "not_configured", "latency_ms": 0,
		})
	}

	response.OK(c, gin.H{
		"status":       overall,
		"service":      "hue-travel-api",
		"version":      "1.0.0",
		"dependencies": deps,
		"timestamp":    time.Now().Format(time.RFC3339),
	})
}
