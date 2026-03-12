package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Admin Handler — Dashboard & Management
// Now queries real DB when available
// ============================================

type AdminHandler struct {
	pool *pgxpool.Pool // nil = mock mode
}

func NewAdminHandler(pool *pgxpool.Pool) *AdminHandler {
	return &AdminHandler{pool: pool}
}

// DashboardStats — tổng quan admin
func (h *AdminHandler) DashboardStats(c *gin.Context) {
	if h.pool != nil {
		// Real DB queries
		ctx := c.Request.Context()

		var totalUsers, newUsersToday int
		h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&totalUsers)
		h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE`).Scan(&newUsersToday)

		var totalBookings, bookingsToday int
		h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM bookings`).Scan(&totalBookings)
		h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM bookings WHERE created_at >= CURRENT_DATE`).Scan(&bookingsToday)

		var revenueMonth int64
		h.pool.QueryRow(ctx, `
			SELECT COALESCE(SUM(total_price), 0) FROM bookings 
			WHERE status IN ('confirmed', 'completed') 
			AND created_at >= date_trunc('month', CURRENT_DATE)`,
		).Scan(&revenueMonth)

		var avgRating float64
		h.pool.QueryRow(ctx, `SELECT COALESCE(AVG(overall_rating), 0) FROM reviews`).Scan(&avgRating)

		var activeGuides int
		h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM guide_profiles WHERE is_available = TRUE`).Scan(&activeGuides)

		var pendingBookings int
		h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM bookings WHERE status = 'pending'`).Scan(&pendingBookings)

		var totalExperiences int
		h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM experiences WHERE is_active = TRUE`).Scan(&totalExperiences)

		// Revenue by month (last 12 months)
		revenueChart := []gin.H{}
		months := []string{"T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"}
		rows, err := h.pool.Query(ctx, `
			SELECT EXTRACT(MONTH FROM created_at)::int AS m, COALESCE(SUM(total_price), 0)
			FROM bookings 
			WHERE status IN ('confirmed', 'completed')
			AND created_at >= date_trunc('year', CURRENT_DATE)
			GROUP BY m ORDER BY m`)
		if err == nil {
			monthRevenue := make(map[int]int64)
			for rows.Next() {
				var m int
				var rev int64
				rows.Scan(&m, &rev)
				monthRevenue[m] = rev
			}
			rows.Close()
			for i, month := range months {
				revenueChart = append(revenueChart, gin.H{
					"month":   month,
					"revenue": monthRevenue[i+1],
				})
			}
		}

		// Top experiences
		topExperiences := []gin.H{}
		topRows, err := h.pool.Query(ctx, `
			SELECT e.title, COUNT(b.id) as booking_count, 
				   COALESCE(SUM(b.total_price), 0) as total_rev,
				   COALESCE(e.rating, 0)
			FROM experiences e
			LEFT JOIN bookings b ON b.experience_id = e.id AND b.status IN ('confirmed', 'completed')
			WHERE e.is_active = TRUE
			GROUP BY e.id, e.title, e.rating
			ORDER BY booking_count DESC
			LIMIT 5`)
		if err == nil {
			for topRows.Next() {
				var title string
				var bookings int
				var revenue int64
				var rating float64
				topRows.Scan(&title, &bookings, &revenue, &rating)
				topExperiences = append(topExperiences, gin.H{
					"name": title, "bookings": bookings,
					"revenue": revenue, "rating": rating,
				})
			}
			topRows.Close()
		}

		// Recent bookings
		recentBookings := []gin.H{}
		recentRows, err := h.pool.Query(ctx, `
			SELECT b.id, u.full_name, e.title, b.booking_date, b.total_price, b.status, b.created_at
			FROM bookings b
			JOIN users u ON b.traveler_id = u.id
			JOIN experiences e ON b.experience_id = e.id
			ORDER BY b.created_at DESC LIMIT 5`)
		if err == nil {
			for recentRows.Next() {
				var id, userName, expTitle, status string
				var bookingDate time.Time
				var amount int64
				var createdAt time.Time
				recentRows.Scan(&id, &userName, &expTitle, &bookingDate, &amount, &status, &createdAt)
				recentBookings = append(recentBookings, gin.H{
					"id": id[:13], "user_name": userName,
					"experience": expTitle, "date": bookingDate.Format("2006-01-02"),
					"amount": amount, "status": status, "created_at": createdAt,
				})
			}
			recentRows.Close()
		}

		response.OK(c, gin.H{
			"stats": gin.H{
				"total_users":        totalUsers,
				"new_users_today":    newUsersToday,
				"total_bookings":     totalBookings,
				"bookings_today":     bookingsToday,
				"revenue_month":      revenueMonth,
				"avg_rating":         avgRating,
				"active_guides":      activeGuides,
				"pending_bookings":   pendingBookings,
				"total_experiences":  totalExperiences,
			},
			"revenue_chart":    revenueChart,
			"top_experiences":  topExperiences,
			"recent_bookings":  recentBookings,
			"generated_at":     time.Now(),
		})
		return
	}

	// Fallback: mock data when DB is not available
	response.OK(c, gin.H{
		"stats": gin.H{
			"total_users":       0,
			"new_users_today":   0,
			"total_bookings":    0,
			"bookings_today":    0,
			"revenue_month":     0,
			"avg_rating":        0,
			"active_guides":     0,
			"pending_bookings":  0,
			"total_experiences": 0,
		},
		"revenue_chart":   []gin.H{},
		"top_experiences": []gin.H{},
		"recent_bookings": []gin.H{},
		"generated_at":    time.Now(),
		"_note":           "Running in mock mode — DB not connected",
	})
}

// SystemHealth — trạng thái hệ thống thật
func (h *AdminHandler) SystemHealth(c *gin.Context) {
	services := []gin.H{}

	// Check PostgreSQL
	if h.pool != nil {
		start := time.Now()
		err := h.pool.Ping(c.Request.Context())
		latency := time.Since(start).Milliseconds()
		status := "connected"
		if err != nil {
			status = "error"
		}
		services = append(services, gin.H{
			"name": "PostgreSQL", "status": status, "latency_ms": latency,
		})
	} else {
		services = append(services, gin.H{
			"name": "PostgreSQL", "status": "not_configured", "latency_ms": 0,
		})
	}

	response.OK(c, gin.H{
		"api": gin.H{
			"status":  "healthy",
			"version": "1.0.0",
		},
		"services": services,
	})
}

// QuickStats — mini stats (real DB counts)
func (h *AdminHandler) QuickStats(c *gin.Context) {
	if h.pool != nil {
		ctx := c.Request.Context()
		var pendingBookings, newUsers int

		h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM bookings WHERE status = 'pending'`).Scan(&pendingBookings)
		h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE`).Scan(&newUsers)

		response.OK(c, gin.H{
			"pending_bookings": pendingBookings,
			"new_users":        newUsers,
		})
		return
	}

	response.OK(c, gin.H{
		"pending_bookings": 0,
		"new_users":        0,
		"_note":            "mock mode",
	})
}
