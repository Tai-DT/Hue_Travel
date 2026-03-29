package handler

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/huetravel/api/internal/config"
	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/internal/service"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Admin Handler — Dashboard & Management
// Now queries real DB when available
// ============================================

type AdminHandler struct {
	pool          *pgxpool.Pool // nil = mock mode
	settingsRepo  *repository.AdminSettingsRepository
	baseConfig    *config.Config
	aiService     *service.AITripPlannerService
	vnpayService  *service.VNPayService
	notifService  *service.NotificationService
	searchService *service.SearchService
	uploadService *service.FileUploadService
}

func NewAdminHandler(
	pool *pgxpool.Pool,
	settingsRepo *repository.AdminSettingsRepository,
	baseConfig *config.Config,
	aiService *service.AITripPlannerService,
	vnpayService *service.VNPayService,
	notifService *service.NotificationService,
	searchService *service.SearchService,
	uploadService *service.FileUploadService,
) *AdminHandler {
	return &AdminHandler{
		pool:          pool,
		settingsRepo:  settingsRepo,
		baseConfig:    baseConfig,
		aiService:     aiService,
		vnpayService:  vnpayService,
		notifService:  notifService,
		searchService: searchService,
		uploadService: uploadService,
	}
}

var allowedAdminSettingKeys = map[string]struct{}{
	"gemini_api_key":    {},
	"ai_temperature":    {},
	"ai_max_tokens":     {},
	"vnpay_tmn_code":    {},
	"vnpay_hash_secret": {},
	"vnpay_url":         {},
	"fcm_server_key":    {},
	"minio_endpoint":    {},
	"minio_bucket":      {},
	"minio_access_key":  {},
	"minio_secret_key":  {},
	"meili_url":         {},
	"meili_master_key":  {},
}

type adminSettingsRequest struct {
	Settings map[string]string `json:"settings"`
}

type adminRuntimeSettings struct {
	GeminiAPIKey   string
	AITemperature  *float64
	AIMaxTokens    *int
	VNPayTMNCode   string
	VNPaySecret    string
	VNPayURL       string
	FCMServerKey   string
	MinIOEndpoint  string
	MinIOBucket    string
	MinIOAccess    string
	MinIOSecret    string
	MeiliURL       string
	MeiliMasterKey string
}

func (h *AdminHandler) ApplyStoredSettings(ctx context.Context) error {
	if h.settingsRepo == nil {
		return nil
	}

	settings, _, err := h.settingsRepo.List(ctx)
	if err != nil {
		return err
	}

	h.applyRuntimeSettings(ctx, settings)
	return nil
}

func (h *AdminHandler) applyRuntimeSettings(ctx context.Context, stored map[string]string) {
	if h.baseConfig == nil {
		return
	}

	effective := h.effectiveRuntimeSettings(stored)

	if h.aiService != nil {
		h.aiService.UpdateConfig(effective.GeminiAPIKey, effective.AITemperature, effective.AIMaxTokens)
	}
	if h.vnpayService != nil {
		h.vnpayService.UpdateConfig(effective.VNPayTMNCode, effective.VNPaySecret, effective.VNPayURL)
	}
	if h.notifService != nil {
		h.notifService.UpdateConfig(effective.FCMServerKey)
	}
	if h.searchService != nil {
		h.searchService.UpdateConfig(ctx, effective.MeiliURL, effective.MeiliMasterKey, h.pool)
	}
	if h.uploadService != nil {
		h.uploadService.UpdateConfig(
			effective.MinIOEndpoint,
			effective.MinIOBucket,
			effective.MinIOAccess,
			effective.MinIOSecret,
		)
	}
}

func (h *AdminHandler) effectiveRuntimeSettings(stored map[string]string) adminRuntimeSettings {
	runtime := adminRuntimeSettings{
		GeminiAPIKey:   h.baseConfig.AI.GeminiAPIKey,
		VNPayTMNCode:   h.baseConfig.VNPay.TmnCode,
		VNPaySecret:    h.baseConfig.VNPay.HashSecret,
		VNPayURL:       service.DefaultVNPayPaymentURL(h.baseConfig.VNPay.Sandbox),
		FCMServerKey:   h.baseConfig.FCM.ServerKey,
		MinIOEndpoint:  h.baseConfig.MinIO.Endpoint,
		MinIOBucket:    h.baseConfig.MinIO.Bucket,
		MinIOAccess:    h.baseConfig.MinIO.User,
		MinIOSecret:    h.baseConfig.MinIO.Password,
		MeiliURL:       h.baseConfig.Meilisearch.URL,
		MeiliMasterKey: h.baseConfig.Meilisearch.MasterKey,
	}

	for key, value := range stored {
		switch key {
		case "gemini_api_key":
			runtime.GeminiAPIKey = value
		case "ai_temperature":
			runtime.AITemperature = mustParseOptionalFloat(value)
		case "ai_max_tokens":
			runtime.AIMaxTokens = mustParseOptionalInt(value)
		case "vnpay_tmn_code":
			runtime.VNPayTMNCode = value
		case "vnpay_hash_secret":
			runtime.VNPaySecret = value
		case "vnpay_url":
			if strings.TrimSpace(value) != "" {
				runtime.VNPayURL = value
			}
		case "fcm_server_key":
			runtime.FCMServerKey = value
		case "minio_endpoint":
			runtime.MinIOEndpoint = value
		case "minio_bucket":
			runtime.MinIOBucket = value
		case "minio_access_key":
			runtime.MinIOAccess = value
		case "minio_secret_key":
			runtime.MinIOSecret = value
		case "meili_url":
			runtime.MeiliURL = value
		case "meili_master_key":
			runtime.MeiliMasterKey = value
		}
	}

	return runtime
}

func validateAdminSetting(key, value string) error {
	switch key {
	case "ai_temperature":
		parsed, err := parseOptionalFloat(value)
		if err != nil {
			return fmt.Errorf("Giá trị temperature không hợp lệ")
		}
		if parsed != nil && (*parsed < 0 || *parsed > 2) {
			return fmt.Errorf("Temperature phải nằm trong khoảng 0-2")
		}
	case "ai_max_tokens":
		parsed, err := parseOptionalInt(value)
		if err != nil {
			return fmt.Errorf("Giá trị max tokens không hợp lệ")
		}
		if parsed != nil && (*parsed < 1 || *parsed > 8192) {
			return fmt.Errorf("Max tokens phải nằm trong khoảng 1-8192")
		}
	case "vnpay_url", "meili_url":
		trimmed := strings.TrimSpace(value)
		if trimmed != "" && !strings.HasPrefix(trimmed, "http://") && !strings.HasPrefix(trimmed, "https://") {
			return fmt.Errorf("URL không hợp lệ cho %s", key)
		}
	}
	return nil
}

func parseOptionalFloat(value string) (*float64, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func mustParseOptionalFloat(value string) *float64 {
	parsed, err := parseOptionalFloat(value)
	if err != nil {
		return nil
	}
	return parsed
}

func parseOptionalInt(value string) (*int, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := strconv.Atoi(trimmed)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func mustParseOptionalInt(value string) *int {
	parsed, err := parseOptionalInt(value)
	if err != nil {
		return nil
	}
	return parsed
}

// GetSettings returns centrally stored admin settings for the dashboard UI.
func (h *AdminHandler) GetSettings(c *gin.Context) {
	if h.settingsRepo == nil {
		response.OK(c, gin.H{
			"settings":   map[string]string{},
			"updated_at": nil,
		})
		return
	}

	settings, updatedAt, err := h.settingsRepo.List(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Không thể tải cài đặt hệ thống")
		return
	}

	response.OK(c, gin.H{
		"settings":   settings,
		"updated_at": updatedAt,
	})
}

// SaveSettings persists admin-managed configuration drafts to the database.
func (h *AdminHandler) SaveSettings(c *gin.Context) {
	if h.settingsRepo == nil {
		response.InternalError(c, "Hệ thống hiện chưa sẵn sàng để lưu cài đặt")
		return
	}

	var req adminSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu cài đặt không hợp lệ")
		return
	}

	sanitized := make(map[string]string, len(req.Settings))
	for key, value := range req.Settings {
		if _, ok := allowedAdminSettingKeys[key]; !ok {
			response.BadRequest(c, "HT-VAL-002", "Khóa cài đặt không hợp lệ: "+key)
			return
		}
		if len(strings.TrimSpace(value)) > 4096 {
			response.BadRequest(c, "HT-VAL-003", "Giá trị cài đặt quá dài: "+key)
			return
		}
		if err := validateAdminSetting(key, value); err != nil {
			response.BadRequest(c, "HT-VAL-004", err.Error())
			return
		}
		sanitized[key] = value
	}

	rawUserID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "Không xác định được tài khoản admin")
		return
	}

	userID, ok := rawUserID.(uuid.UUID)
	if !ok {
		response.Unauthorized(c, "Không xác định được tài khoản admin")
		return
	}

	updatedAt, err := h.settingsRepo.UpsertMany(c.Request.Context(), sanitized, userID)
	if err != nil {
		response.InternalError(c, "Không thể lưu cài đặt hệ thống")
		return
	}

	storedSettings, _, err := h.settingsRepo.List(c.Request.Context())
	if err == nil {
		h.applyRuntimeSettings(c.Request.Context(), storedSettings)
	}

	response.OK(c, gin.H{
		"settings":   sanitized,
		"updated_at": updatedAt,
		"count":      len(sanitized),
	})
}

// DashboardStats — tổng quan admin
func (h *AdminHandler) DashboardStats(c *gin.Context) {
	if h.pool != nil {
		// Real DB queries
		ctx := c.Request.Context()
		days, _ := strconv.Atoi(c.DefaultQuery("days", "0"))
		if days < 0 {
			days = 0
		}

		var periodStart *time.Time
		if days > 0 {
			start := time.Now().AddDate(0, 0, -days)
			periodStart = &start
		}

		queryInt := func(defaultQuery string, filteredQuery string, dest *int) {
			if periodStart != nil {
				h.pool.QueryRow(ctx, filteredQuery, *periodStart).Scan(dest)
				return
			}
			h.pool.QueryRow(ctx, defaultQuery).Scan(dest)
		}

		queryInt64 := func(defaultQuery string, filteredQuery string, dest *int64) {
			if periodStart != nil {
				h.pool.QueryRow(ctx, filteredQuery, *periodStart).Scan(dest)
				return
			}
			h.pool.QueryRow(ctx, defaultQuery).Scan(dest)
		}

		queryFloat := func(defaultQuery string, filteredQuery string, dest *float64) {
			if periodStart != nil {
				h.pool.QueryRow(ctx, filteredQuery, *periodStart).Scan(dest)
				return
			}
			h.pool.QueryRow(ctx, defaultQuery).Scan(dest)
		}

		var totalUsers, newUsersToday, newUsersThisMonth int
		queryInt(
			`SELECT COUNT(*) FROM users`,
			`SELECT COUNT(*) FROM users WHERE created_at >= $1`,
			&totalUsers,
		)
		h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE`).Scan(&newUsersToday)
		if periodStart != nil {
			newUsersThisMonth = totalUsers
		} else {
			h.pool.QueryRow(ctx, `
				SELECT COUNT(*) FROM users
				WHERE created_at >= date_trunc('month', CURRENT_DATE)`,
			).Scan(&newUsersThisMonth)
		}

		var totalBookings, bookingsToday, bookingsThisMonth int
		queryInt(
			`SELECT COUNT(*) FROM bookings`,
			`SELECT COUNT(*) FROM bookings WHERE created_at >= $1`,
			&totalBookings,
		)
		h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM bookings WHERE created_at >= CURRENT_DATE`).Scan(&bookingsToday)
		if periodStart != nil {
			bookingsThisMonth = totalBookings
		} else {
			h.pool.QueryRow(ctx, `
				SELECT COUNT(*) FROM bookings
				WHERE created_at >= date_trunc('month', CURRENT_DATE)`,
			).Scan(&bookingsThisMonth)
		}

		var totalRevenue, revenueMonth int64
		queryInt64(
			`SELECT COALESCE(SUM(total_price), 0) FROM bookings
			WHERE status IN ('confirmed', 'completed')`,
			`SELECT COALESCE(SUM(total_price), 0) FROM bookings
			WHERE status IN ('confirmed', 'completed') AND created_at >= $1`,
			&totalRevenue,
		)
		if periodStart != nil {
			revenueMonth = totalRevenue
		} else {
			h.pool.QueryRow(ctx, `
				SELECT COALESCE(SUM(total_price), 0) FROM bookings 
				WHERE status IN ('confirmed', 'completed') 
				AND created_at >= date_trunc('month', CURRENT_DATE)`,
			).Scan(&revenueMonth)
		}

		var avgRating float64
		queryFloat(
			`SELECT COALESCE(AVG(overall_rating), 0) FROM reviews`,
			`SELECT COALESCE(AVG(overall_rating), 0) FROM reviews WHERE created_at >= $1`,
			&avgRating,
		)

		var activeGuides int
		h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM guide_profiles WHERE is_available = TRUE`).Scan(&activeGuides)

		var pendingBookings int
		queryInt(
			`SELECT COUNT(*) FROM bookings WHERE status = 'pending'`,
			`SELECT COUNT(*) FROM bookings WHERE status = 'pending' AND created_at >= $1`,
			&pendingBookings,
		)

		var totalExperiences int
		h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM experiences WHERE is_active = TRUE`).Scan(&totalExperiences)

		// Revenue by month (last 12 months)
		revenueChart := []gin.H{}
		months := []string{"T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"}
		var rows pgx.Rows
		var err error
		if periodStart != nil {
			rows, err = h.pool.Query(ctx, `
				SELECT EXTRACT(MONTH FROM created_at)::int AS m, COALESCE(SUM(total_price), 0)
				FROM bookings 
				WHERE status IN ('confirmed', 'completed')
				AND created_at >= $1
				GROUP BY m ORDER BY m`, *periodStart)
		} else {
			rows, err = h.pool.Query(ctx, `
				SELECT EXTRACT(MONTH FROM created_at)::int AS m, COALESCE(SUM(total_price), 0)
				FROM bookings 
				WHERE status IN ('confirmed', 'completed')
				AND created_at >= date_trunc('year', CURRENT_DATE)
				GROUP BY m ORDER BY m`)
		}
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
		var topRows pgx.Rows
		if periodStart != nil {
			topRows, err = h.pool.Query(ctx, `
				SELECT e.title, COUNT(b.id) as booking_count, 
					   COALESCE(SUM(b.total_price), 0) as total_rev,
					   COALESCE(e.rating, 0)
				FROM experiences e
				LEFT JOIN bookings b ON b.experience_id = e.id AND b.status IN ('confirmed', 'completed') AND b.created_at >= $1
				WHERE e.is_active = TRUE
				GROUP BY e.id, e.title, e.rating
				ORDER BY booking_count DESC
				LIMIT 5`, *periodStart)
		} else {
			topRows, err = h.pool.Query(ctx, `
				SELECT e.title, COUNT(b.id) as booking_count, 
					   COALESCE(SUM(b.total_price), 0) as total_rev,
					   COALESCE(e.rating, 0)
				FROM experiences e
				LEFT JOIN bookings b ON b.experience_id = e.id AND b.status IN ('confirmed', 'completed')
				WHERE e.is_active = TRUE
				GROUP BY e.id, e.title, e.rating
				ORDER BY booking_count DESC
				LIMIT 5`)
		}
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
		var recentRows pgx.Rows
		if periodStart != nil {
			recentRows, err = h.pool.Query(ctx, `
				SELECT b.id, u.full_name, e.title, b.booking_date, b.total_price, b.status, b.created_at
				FROM bookings b
				JOIN users u ON b.traveler_id = u.id
				JOIN experiences e ON b.experience_id = e.id
				WHERE b.created_at >= $1
				ORDER BY b.created_at DESC LIMIT 5`, *periodStart)
		} else {
			recentRows, err = h.pool.Query(ctx, `
				SELECT b.id, u.full_name, e.title, b.booking_date, b.total_price, b.status, b.created_at
				FROM bookings b
				JOIN users u ON b.traveler_id = u.id
				JOIN experiences e ON b.experience_id = e.id
				ORDER BY b.created_at DESC LIMIT 5`)
		}
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
				"total_users":          totalUsers,
				"new_users_today":      newUsersToday,
				"new_users_this_month": newUsersThisMonth,
				"total_bookings":       totalBookings,
				"bookings_today":       bookingsToday,
				"bookings_this_month":  bookingsThisMonth,
				"total_revenue":        totalRevenue,
				"revenue_month":        revenueMonth,
				"revenue_this_month":   revenueMonth,
				"avg_rating":           avgRating,
				"active_guides":        activeGuides,
				"pending_bookings":     pendingBookings,
				"total_experiences":    totalExperiences,
			},
			"revenue_chart":   revenueChart,
			"top_experiences": topExperiences,
			"recent_bookings": recentBookings,
			"generated_at":    time.Now(),
		})
		return
	}

	// Fallback: mock data when DB is not available
	response.OK(c, gin.H{
		"stats": gin.H{
			"total_users":          0,
			"new_users_today":      0,
			"new_users_this_month": 0,
			"total_bookings":       0,
			"bookings_today":       0,
			"bookings_this_month":  0,
			"total_revenue":        0,
			"revenue_month":        0,
			"revenue_this_month":   0,
			"avg_rating":           0,
			"active_guides":        0,
			"pending_bookings":     0,
			"total_experiences":    0,
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
