package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/huetravel/api/internal/config"
	"github.com/huetravel/api/internal/handler"
	"github.com/huetravel/api/internal/middleware"
	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/internal/service"
	ws "github.com/huetravel/api/internal/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

const apiVersion = "1.0.0"

func main() {
	ctx := context.Background()

	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Set Gin mode
	if cfg.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// ============================================
	// Connect Database & Redis
	// ============================================
	var (
		userRepo    *repository.UserRepository
		otpRepo     *repository.OTPRepository
		expRepo     *repository.ExperienceRepository
		bookingRepo *repository.BookingRepository
		reviewRepo  *repository.ReviewRepository
		favRepo     *repository.FavoriteRepository
		guideRepo   *repository.GuideProfileRepository
		chatRepo    *repository.ChatRepository
		authSvc     *service.AuthService
		bookingSvc  *service.BookingService
	)

	// Try connecting to PostgreSQL (graceful if not available)
	pool, dbErr := config.NewPostgresPool(ctx, cfg.Database.URL)
	if dbErr != nil {
		log.Printf("⚠️  PostgreSQL not available: %v", dbErr)
		log.Printf("   Running in MOCK mode — start infra with: make infra-up")
	} else {
		defer pool.Close()
		userRepo = repository.NewUserRepository(pool)
		otpRepo = repository.NewOTPRepository(pool)
		expRepo = repository.NewExperienceRepository(pool)
		bookingRepo = repository.NewBookingRepository(pool)
		reviewRepo = repository.NewReviewRepository(pool)
		favRepo = repository.NewFavoriteRepository(pool)
		guideRepo = repository.NewGuideProfileRepository(pool)
		chatRepo = repository.NewChatRepository(pool)
	}

	// Try connecting to Redis (graceful if not available)
	rdb, redisErr := config.NewRedisClient(ctx, cfg.Redis.URL)
	if redisErr != nil {
		log.Printf("⚠️  Redis not available: %v", redisErr)
	}

	// ============================================
	// Initialize Services
	// ============================================
	// SMS service (ESMS.vn)
	smsSvc := service.NewSMSService(cfg.ESMS.APIKey, cfg.ESMS.SecretKey, cfg.ESMS.BrandName)

	if userRepo != nil && otpRepo != nil {
		authSvc = service.NewAuthService(
			userRepo, otpRepo, rdb, smsSvc,
			cfg.JWT.Secret, cfg.JWT.Expiry, cfg.JWT.RefreshExpiry,
		)
	}

	if bookingRepo != nil && expRepo != nil && userRepo != nil {
		bookingSvc = service.NewBookingService(
			bookingRepo, expRepo, userRepo, rdb,
		)
	}

	// ============================================
	// Initialize Handlers
	// ============================================
	placesSvc := service.NewGooglePlacesService(cfg.Google.MapsAPIKey)
	aiSvc := service.NewAITripPlannerService(cfg.AI.GeminiAPIKey)
	vnpaySvc := service.NewVNPayService(cfg.VNPay.TmnCode, cfg.VNPay.HashSecret, cfg.VNPay.ReturnURL, cfg.VNPay.Sandbox)

	notifSvc := service.NewNotificationService(cfg.FCM.ServerKey, pool)
	searchSvc := service.NewSearchService(cfg.Meilisearch.URL, cfg.Meilisearch.MasterKey)

	healthH := handler.NewHealthHandler(pool, rdb)
	placeH := handler.NewPlaceHandler(placesSvc)
	aiH := handler.NewAIHandler(aiSvc)
	notifH := handler.NewNotificationHandler(notifSvc, pool)
	adminH := handler.NewAdminHandler(pool)
	searchH := handler.NewSearchHandler(searchSvc)
	docsH := handler.NewDocsHandler()

	// Auth & Booking handlers depend on DB
	var authH *handler.AuthHandler
	var expH *handler.ExperienceHandler
	var bookingH *handler.BookingHandler
	var reviewH *handler.ReviewHandler
	var favH *handler.FavoriteHandler
	var guideH *handler.GuideHandler
	var chatH *handler.ChatHandler
	var paymentH *handler.PaymentHandler
	var uploadH *handler.UploadHandler
	var adminMgmtH *handler.AdminManagementHandler

	if authSvc != nil {
		authH = handler.NewAuthHandler(authSvc, userRepo, rdb)
	}
	if expRepo != nil {
		expH = handler.NewExperienceHandler(expRepo)
	}
	if bookingSvc != nil {
		bookingH = handler.NewBookingHandler(bookingSvc, bookingRepo)
	}
	if reviewRepo != nil && userRepo != nil {
		reviewH = handler.NewReviewHandler(reviewRepo, userRepo)
	}
	if favRepo != nil {
		favH = handler.NewFavoriteHandler(favRepo)
	}
	if guideRepo != nil && expRepo != nil {
		guideH = handler.NewGuideHandler(guideRepo, expRepo)
	}
	if chatRepo != nil {
		chatH = handler.NewChatHandler(chatRepo)
	}
	if bookingRepo != nil && userRepo != nil {
		paymentH = handler.NewPaymentHandler(vnpaySvc, bookingRepo, userRepo)
	}

	// File upload service + handler
	uploadSvc := service.NewFileUploadService(
		cfg.MinIO.Endpoint, cfg.MinIO.User, cfg.MinIO.Password,
		cfg.MinIO.Bucket, cfg.MinIO.UseSSL,
	)
	uploadH = handler.NewUploadHandler(uploadSvc)

	// Admin management handler
	if userRepo != nil && expRepo != nil && bookingRepo != nil {
		adminMgmtH = handler.NewAdminManagementHandler(userRepo, expRepo, bookingRepo)
	}

	// Background worker — cleanup expired bookings & OTPs
	var bgWorker *service.BackgroundWorker
	if pool != nil {
		bgWorker = service.NewBackgroundWorker(pool, rdb)
		bgWorker.Start()
	}

	// ============================================
	// Router Setup
	// ============================================
	r := gin.New()
	r.Use(middleware.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.Logger())
	r.Use(middleware.CORS())
	r.Use(middleware.APIVersion(apiVersion))
	r.Use(middleware.RateLimit(100, time.Minute)) // 100 requests per minute per IP

	// WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	// Health check — detailed with DB/Redis status
	r.GET("/health", healthH.Check)

	// WebSocket endpoint — JWT auth via query param "token" or Sec-WebSocket-Protocol
	r.GET("/ws", middleware.WebSocketAuth(cfg.JWT.Secret), ws.HandleWebSocket(hub))

	// API v1
	v1 := r.Group("/api/v1")
	{
		// ---- Auth (public) ----
		auth := v1.Group("/auth")
		{
			if authH != nil {
				auth.POST("/otp/send", authH.SendOTP)
				auth.POST("/otp/verify", authH.VerifyOTP)
				auth.POST("/google", authH.GoogleLogin)
				auth.POST("/refresh", middleware.Auth(cfg.JWT.Secret), authH.RefreshToken)
				auth.POST("/logout", middleware.Auth(cfg.JWT.Secret), authH.Logout)
			}
		}

		// ---- Experiences ----
		experiences := v1.Group("/experiences")
		{
			if expH != nil {
				experiences.GET("", expH.List)
				experiences.GET("/:id", expH.GetByID)

				authExp := experiences.Group("")
				authExp.Use(middleware.Auth(cfg.JWT.Secret))
				{
					authExp.POST("", middleware.RequireRole("guide", "admin"), expH.Create)
					authExp.PUT("/:id", middleware.RequireRole("guide", "admin"), expH.Update)
					authExp.DELETE("/:id", middleware.RequireRole("guide", "admin"), expH.Delete)
				}
			}
		}

		// ---- Places (public) ----
		places := v1.Group("/places")
		{
			places.GET("/search", placeH.Search)
			places.GET("/nearby", placeH.NearbyRestaurants)
			places.GET("/directions", placeH.GetDirections)
		}

		// ---- Bookings (auth required) ----
		if bookingH != nil {
			bookings := v1.Group("/bookings")
			bookings.Use(middleware.Auth(cfg.JWT.Secret))
			{
				bookings.POST("", bookingH.Create)
				bookings.GET("", bookingH.List)
				bookings.GET("/:id", bookingH.GetByID)
				bookings.POST("/:id/cancel", bookingH.Cancel)
				bookings.POST("/:id/confirm", bookingH.Confirm)
				bookings.POST("/:id/complete", bookingH.Complete)

				// Guide-specific bookings
				bookings.GET("/guide/me", bookingH.GuideBookings)
			}
		}

		// ---- Reviews ----
		if reviewH != nil {
			v1.GET("/experiences/:id/reviews", reviewH.ListByExperience)
			v1.POST("/reviews", middleware.Auth(cfg.JWT.Secret), reviewH.Create)
		}

		// ---- Favorites (auth required) ----
		if favH != nil {
			favs := v1.Group("/favorites")
			favs.Use(middleware.Auth(cfg.JWT.Secret))
			{
				favs.POST("/toggle/:id", favH.Toggle)
				favs.GET("", favH.List)
			}
		}

		// ---- Guides (public) ----
		if guideH != nil {
			guides := v1.Group("/guides")
			{
				guides.GET("/top", guideH.TopGuides)
				guides.GET("/:id", guideH.GetProfile)
			}
		}

		// ---- Chat (auth required) ----
		if chatH != nil {
			chat := v1.Group("/chat")
			chat.Use(middleware.Auth(cfg.JWT.Secret))
			{
				chat.GET("/rooms", chatH.ListRooms)
				chat.POST("/rooms", chatH.GetOrCreateRoom)
				chat.GET("/rooms/:room_id/messages", chatH.GetMessages)
				chat.POST("/rooms/:room_id/messages", chatH.SendMessage)
				chat.POST("/rooms/:room_id/read", chatH.MarkRead)
			}
		}

		// ---- AI Trip Planner (public) ----
		ai := v1.Group("/ai")
		{
			ai.POST("/trip-plan", aiH.GenerateTripPlan)
			ai.POST("/chat", aiH.Chat)
			ai.GET("/suggest", aiH.QuickSuggest)
		}

		// ---- Payment ----
		if paymentH != nil {
			payment := v1.Group("/payment")
			{
				payment.GET("/methods", paymentH.PaymentMethods)
				payment.GET("/callback", paymentH.PaymentCallback)

				paymentAuth := payment.Group("")
				paymentAuth.Use(middleware.Auth(cfg.JWT.Secret))
				{
					paymentAuth.POST("/create", paymentH.CreatePayment)
				}
			}
		}

		// ---- Notifications (auth required) ----
		notif := v1.Group("/notifications")
		notif.Use(middleware.Auth(cfg.JWT.Secret))
		{
			notif.GET("", notifH.GetNotifications)
			notif.GET("/unread", notifH.UnreadCount)
			notif.POST("/:id/read", notifH.MarkRead)
			notif.POST("/device", notifH.RegisterDevice)
		}

		// ---- User Profile (auth required) ----
		if authH != nil {
			v1.GET("/me", middleware.Auth(cfg.JWT.Secret), authH.Me)
			v1.PUT("/me", middleware.Auth(cfg.JWT.Secret), authH.UpdateProfile)
			v1.DELETE("/me", middleware.Auth(cfg.JWT.Secret), authH.DeleteAccount)
		}

		// ---- Guide Profile (auth + guide role) ----
		if guideH != nil {
			guideAuth := v1.Group("/guides")
			guideAuth.Use(middleware.Auth(cfg.JWT.Secret))
			{
				guideAuth.PUT("/me/profile", middleware.RequireRole("guide", "admin"), guideH.UpdateProfile)
			}
		}

		// ---- File Upload (auth required) ----
		if uploadH != nil {
			upload := v1.Group("/upload")
			upload.Use(middleware.Auth(cfg.JWT.Secret))
			{
				upload.POST("", uploadH.UploadFile)
				upload.POST("/avatar", uploadH.UploadAvatar)
			}
		}

		// ---- Admin (auth + admin role required) ----
		admin := v1.Group("/admin")
		admin.Use(middleware.Auth(cfg.JWT.Secret))
		admin.Use(middleware.RequireRole("admin"))
		{
			admin.GET("/dashboard", adminH.DashboardStats)
			admin.GET("/health", adminH.SystemHealth)
			admin.GET("/quick-stats", adminH.QuickStats)

			// Admin Management CRUD
			if adminMgmtH != nil {
				// Users
				admin.GET("/users", adminMgmtH.ListUsers)
				admin.GET("/users/:id", adminMgmtH.GetUser)
				admin.PUT("/users/:id/status", adminMgmtH.BanUser)
				admin.PUT("/users/:id/role", adminMgmtH.ChangeRole)

				// Experiences
				admin.GET("/experiences", adminMgmtH.ListExperiences)
				admin.DELETE("/experiences/:id", adminMgmtH.DeleteExperience)

				// Bookings
				admin.GET("/bookings", adminMgmtH.ListBookings)
				admin.PUT("/bookings/:id/status", adminMgmtH.UpdateBookingStatus)
			}
		}

		// ---- Search ----
		search := v1.Group("/search")
		{
			search.GET("", searchH.Search)
			search.GET("/suggest", searchH.Suggest)
			search.GET("/trending", searchH.Trending)
			search.GET("/stats", searchH.IndexStats)
		}

		// ---- Docs ----
		v1.GET("/docs", docsH.GetDocs)
	}

	// ============================================
	// Graceful Shutdown with Signal Handling
	// ============================================
	port := cfg.App.Port
	dbStatus := "❌ disconnected"
	redisStatus := "❌ disconnected"
	if dbErr == nil {
		dbStatus = "✅ connected"
	}
	if redisErr == nil {
		redisStatus = "✅ connected"
	}

	fmt.Fprintf(os.Stdout, `
  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║   🌏 Huế Travel API v%-19s ║
  ║                                          ║
  ║   Environment: %-25s ║
  ║   Port:        %-25s ║
  ║   PostgreSQL:  %-25s ║
  ║   Redis:       %-25s ║
  ║                                          ║
  ╚══════════════════════════════════════════╝
`, apiVersion, cfg.App.Env, port, dbStatus, redisStatus)

	// Create HTTP server for graceful shutdown
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	log.Printf("🛑 Received signal %v — shutting down gracefully...", sig)

	// Give outstanding requests 10 seconds to complete
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	// Stop background worker
	if bgWorker != nil {
		bgWorker.Stop()
	}

	// Stop WebSocket hub
	hub.Stop()

	log.Println("✅ Server exited gracefully")
}

// unused but kept for reference — original pool/rdb types
var _ *pgxpool.Pool
var _ *redis.Client
