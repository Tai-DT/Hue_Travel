// Package app provides the application bootstrapping: DI container and route registration.
package app

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/huetravel/api/internal/config"
	"github.com/huetravel/api/internal/handler"
	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/internal/service"
)

// Container holds all application dependencies (DI container).
// It centralizes initialization and provides clean access to all layers.
type Container struct {
	Config *config.Config
	Pool   *pgxpool.Pool
	Redis  *redis.Client

	// Repositories
	UserRepo    *repository.UserRepository
	OTPRepo     *repository.OTPRepository
	ExpRepo     *repository.ExperienceRepository
	BookingRepo *repository.BookingRepository
	ReviewRepo  *repository.ReviewRepository
	FavRepo     *repository.FavoriteRepository
	GuideRepo   *repository.GuideProfileRepository
	ChatRepo    *repository.ChatRepository

	// Services
	AuthSvc    *service.AuthService
	BookingSvc *service.BookingService
	PlacesSvc  *service.GoongPlacesService
	AISvc      *service.AITripPlannerService
	VNPaySvc   *service.VNPayService
	NotifSvc   *service.NotificationService
	SearchSvc  *service.SearchService
	SMSSvc     *service.SMSService
	UploadSvc  *service.FileUploadService
	BGWorker   *service.BackgroundWorker

	// Handlers
	HealthH    *handler.HealthHandler
	AuthH      *handler.AuthHandler
	ExpH       *handler.ExperienceHandler
	PlaceH     *handler.PlaceHandler
	BookingH   *handler.BookingHandler
	ReviewH    *handler.ReviewHandler
	FavH       *handler.FavoriteHandler
	GuideH     *handler.GuideHandler
	ChatH      *handler.ChatHandler
	AIH        *handler.AIHandler
	PaymentH   *handler.PaymentHandler
	NotifH     *handler.NotificationHandler
	SearchH    *handler.SearchHandler
	UploadH    *handler.UploadHandler
	AdminH     *handler.AdminHandler
	AdminMgmtH *handler.AdminManagementHandler
	DocsH      *handler.DocsHandler

	// Status
	DBConnected    bool
	RedisConnected bool
}

// NewContainer creates and initializes all dependencies.
func NewContainer(ctx context.Context, cfg *config.Config) *Container {
	c := &Container{Config: cfg}
	c.initInfra(ctx)
	c.initRepositories()
	c.initServices()
	c.initHandlers()
	c.initBackground()
	return c
}

func (c *Container) initInfra(ctx context.Context) {
	// PostgreSQL — graceful if not available
	pool, err := config.NewPostgresPool(ctx, c.Config.Database.URL)
	if err != nil {
		if c.Config.App.StrictMode {
			slog.Error("PostgreSQL connection failed (strict mode)", "error", err)
			panic(fmt.Sprintf("Failed to connect to PostgreSQL: %v", err))
		}
		slog.Warn("PostgreSQL not available — running in MOCK mode",
			"error", err, "hint", "start infra with: make infra-up")
	} else {
		c.Pool = pool
		c.DBConnected = true
		slog.Info("PostgreSQL connected")
	}

	// Redis — graceful if not available
	rdb, err := config.NewRedisClient(ctx, c.Config.Redis.URL)
	if err != nil {
		if c.Config.App.StrictMode {
			slog.Error("Redis connection failed (strict mode)", "error", err)
			panic(fmt.Sprintf("Failed to connect to Redis: %v", err))
		}
		slog.Warn("Redis not available", "error", err)
	} else {
		c.Redis = rdb
		c.RedisConnected = true
		slog.Info("Redis connected")
	}
}

func (c *Container) initRepositories() {
	if c.Pool == nil {
		slog.Warn("Skipping repository init — no database connection")
		return
	}

	c.UserRepo = repository.NewUserRepository(c.Pool)
	c.OTPRepo = repository.NewOTPRepository(c.Pool)
	c.ExpRepo = repository.NewExperienceRepository(c.Pool)
	c.BookingRepo = repository.NewBookingRepository(c.Pool)
	c.ReviewRepo = repository.NewReviewRepository(c.Pool)
	c.FavRepo = repository.NewFavoriteRepository(c.Pool)
	c.GuideRepo = repository.NewGuideProfileRepository(c.Pool)
	c.ChatRepo = repository.NewChatRepository(c.Pool)

	slog.Info("All repositories initialized")
}

func (c *Container) initServices() {
	cfg := c.Config

	// SMS service
	c.SMSSvc = service.NewSMSService(cfg.ESMS.APIKey, cfg.ESMS.SecretKey, cfg.ESMS.BrandName)

	// Auth service (requires DB)
	if c.UserRepo != nil && c.OTPRepo != nil {
		c.AuthSvc = service.NewAuthService(
			c.UserRepo, c.OTPRepo, c.Redis, c.SMSSvc,
			cfg.JWT.Secret, cfg.JWT.Expiry, cfg.JWT.RefreshExpiry,
		)
	}

	// Booking service (requires DB)
	if c.BookingRepo != nil && c.ExpRepo != nil && c.UserRepo != nil {
		c.BookingSvc = service.NewBookingService(
			c.BookingRepo, c.ExpRepo, c.UserRepo, c.Redis,
		)
	}

	// External-API services (always init — they handle "not configured" gracefully)
	c.PlacesSvc = service.NewGoongPlacesService(cfg.Goong.APIKey)
	c.AISvc = service.NewAITripPlannerService(cfg.AI.GeminiAPIKey)
	c.VNPaySvc = service.NewVNPayService(cfg.VNPay.TmnCode, cfg.VNPay.HashSecret, cfg.VNPay.ReturnURL, cfg.VNPay.Sandbox)
	c.NotifSvc = service.NewNotificationService(cfg.FCM.ServerKey, c.Pool)
	c.SearchSvc = service.NewSearchService(cfg.Meilisearch.URL, cfg.Meilisearch.MasterKey)
	c.UploadSvc = service.NewFileUploadService(
		cfg.MinIO.Endpoint, cfg.MinIO.User, cfg.MinIO.Password,
		cfg.MinIO.Bucket, cfg.MinIO.UseSSL,
	)

	slog.Info("All services initialized")
}

func (c *Container) initHandlers() {
	// Always-available handlers
	c.HealthH = handler.NewHealthHandler(c.Pool, c.Redis)
	c.PlaceH = handler.NewPlaceHandler(c.PlacesSvc)
	c.AIH = handler.NewAIHandler(c.AISvc)
	c.NotifH = handler.NewNotificationHandler(c.NotifSvc, c.Pool)
	c.AdminH = handler.NewAdminHandler(c.Pool)
	c.SearchH = handler.NewSearchHandler(c.SearchSvc)
	c.DocsH = handler.NewDocsHandler()
	c.UploadH = handler.NewUploadHandler(c.UploadSvc)

	// DB-dependent handlers
	if c.AuthSvc != nil {
		c.AuthH = handler.NewAuthHandler(c.AuthSvc)
	}
	if c.ExpRepo != nil {
		c.ExpH = handler.NewExperienceHandler(c.ExpRepo)
	}
	if c.BookingSvc != nil {
		c.BookingH = handler.NewBookingHandler(c.BookingSvc)
	}
	if c.ReviewRepo != nil && c.UserRepo != nil {
		c.ReviewH = handler.NewReviewHandler(c.ReviewRepo, c.UserRepo)
	}
	if c.FavRepo != nil {
		c.FavH = handler.NewFavoriteHandler(c.FavRepo)
	}
	if c.GuideRepo != nil && c.ExpRepo != nil {
		c.GuideH = handler.NewGuideHandler(c.GuideRepo, c.ExpRepo)
	}
	if c.ChatRepo != nil {
		c.ChatH = handler.NewChatHandler(c.ChatRepo)
	}
	if c.BookingRepo != nil && c.UserRepo != nil {
		c.PaymentH = handler.NewPaymentHandler(c.VNPaySvc, c.BookingRepo, c.UserRepo)
	}
	if c.UserRepo != nil && c.ExpRepo != nil && c.BookingRepo != nil {
		c.AdminMgmtH = handler.NewAdminManagementHandler(c.UserRepo, c.ExpRepo, c.BookingRepo, c.ReviewRepo)
	}

	slog.Info("All handlers initialized")
}

func (c *Container) initBackground() {
	if c.Pool != nil {
		c.BGWorker = service.NewBackgroundWorker(c.Pool, c.Redis)
		c.BGWorker.Start()
		slog.Info("Background worker started")
	}
}

// Close cleans up all resources.
func (c *Container) Close() {
	if c.BGWorker != nil {
		c.BGWorker.Stop()
	}
	if c.Pool != nil {
		c.Pool.Close()
	}
	slog.Info("All resources cleaned up")
}
