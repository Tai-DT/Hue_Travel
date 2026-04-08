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
	UserRepo          *repository.UserRepository
	ExpRepo           *repository.ExperienceRepository
	BookingRepo       *repository.BookingRepository
	ReviewRepo        *repository.ReviewRepository
	FavRepo           *repository.FavoriteRepository
	GuideRepo         *repository.GuideProfileRepository
	ChatRepo          *repository.ChatRepository
	FriendRepo        *repository.FriendRepository
	TripRepo          *repository.TripRepository
	ReactionRepo      *repository.ReactionRepository
	PromoRepo         *repository.PromotionRepository
	GamRepo           *repository.GamificationRepository
	BlogRepo          *repository.BlogRepository
	DiaryRepo         *repository.DiaryRepository
	EventRepo         *repository.EventRepository
	SOSRepo           *repository.SOSRepository
	ReportRepo        *repository.ReportBlockRepository
	GuideAppRepo      *repository.GuideAppRepository
	StoryRepo         *repository.StoryRepository
	CollectionRepo    *repository.CollectionRepository
	AdminSettingsRepo *repository.AdminSettingsRepository
	UserPrefRepo      *repository.UserPreferencesRepository

	// Services
	AuthSvc    *service.AuthService
	BookingSvc *service.BookingService
	PlacesSvc  *service.GoongPlacesService
	AISvc      *service.AITripPlannerService
	VNPaySvc   *service.VNPayService
	NotifSvc   *service.NotificationService
	SearchSvc  *service.SearchService
	UploadSvc  *service.FileUploadService
	WeatherSvc *service.WeatherService
	BGWorker   *service.BackgroundWorker

	// Handlers
	HealthH       *handler.HealthHandler
	AuthH         *handler.AuthHandler
	ExpH          *handler.ExperienceHandler
	PlaceH        *handler.PlaceHandler
	BookingH      *handler.BookingHandler
	ReviewH       *handler.ReviewHandler
	FavH          *handler.FavoriteHandler
	GuideH        *handler.GuideHandler
	ChatH         *handler.ChatHandler
	AIH           *handler.AIHandler
	PaymentH      *handler.PaymentHandler
	NotifH        *handler.NotificationHandler
	SearchH       *handler.SearchHandler
	UploadH       *handler.UploadHandler
	AdminH        *handler.AdminHandler
	AdminMgmtH    *handler.AdminManagementHandler
	DocsH         *handler.DocsHandler
	FriendH       *handler.FriendHandler
	TripH         *handler.TripHandler
	ReactionH     *handler.ReactionHandler
	WeatherH      *handler.WeatherHandler
	PromoH        *handler.PromotionHandler
	GamH          *handler.GamificationHandler
	BlogH         *handler.BlogHandler
	DiaryH        *handler.DiaryHandler
	EventH        *handler.EventHandler
	SOSH          *handler.SOSHandler
	TranslateH    *handler.TranslationHandler
	ReportH       *handler.ReportBlockHandler
	GuideAppH     *handler.GuideAppHandler
	StoryH        *handler.StoryHandler
	CollectionH   *handler.CollectionHandler
	TranslateNewH *handler.TranslateHandler

	// Status
	DBConnected    bool
	RedisConnected bool
}

// NewContainer creates and initializes all dependencies.
func NewContainer(ctx context.Context, cfg *config.Config) *Container {
	c := &Container{Config: cfg}
	c.initInfra(ctx)
	c.initRepositories()
	c.initServices(ctx)
	c.initHandlers()
	c.applyAdminRuntimeSettings(ctx)
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
	c.ExpRepo = repository.NewExperienceRepository(c.Pool)
	c.BookingRepo = repository.NewBookingRepository(c.Pool)
	c.ReviewRepo = repository.NewReviewRepository(c.Pool)
	c.FavRepo = repository.NewFavoriteRepository(c.Pool)
	c.GuideRepo = repository.NewGuideProfileRepository(c.Pool)
	c.ChatRepo = repository.NewChatRepository(c.Pool)
	c.FriendRepo = repository.NewFriendRepository(c.Pool)
	c.TripRepo = repository.NewTripRepository(c.Pool)
	c.ReactionRepo = repository.NewReactionRepository(c.Pool)
	c.PromoRepo = repository.NewPromotionRepository(c.Pool)
	c.GamRepo = repository.NewGamificationRepository(c.Pool)
	c.BlogRepo = repository.NewBlogRepository(c.Pool)
	c.DiaryRepo = repository.NewDiaryRepository(c.Pool)
	c.EventRepo = repository.NewEventRepository(c.Pool)
	c.SOSRepo = repository.NewSOSRepository(c.Pool)
	c.ReportRepo = repository.NewReportBlockRepository(c.Pool)
	c.GuideAppRepo = repository.NewGuideAppRepository(c.Pool)
	c.StoryRepo = repository.NewStoryRepository(c.Pool)
	c.CollectionRepo = repository.NewCollectionRepository(c.Pool)
	c.AdminSettingsRepo = repository.NewAdminSettingsRepository(c.Pool)
	c.UserPrefRepo = repository.NewUserPreferencesRepository(c.Pool)

	slog.Info("All repositories initialized")
}

func (c *Container) initServices(ctx context.Context) {
	cfg := c.Config

	// Auth service (requires DB)
	if c.UserRepo != nil {
		c.AuthSvc = service.NewAuthService(
			c.UserRepo, c.Redis,
			cfg.JWT.Secret, cfg.JWT.Expiry, cfg.JWT.RefreshExpiry,
		)
	}

	// Booking service (requires DB)
	if c.BookingRepo != nil && c.ExpRepo != nil && c.UserRepo != nil {
		c.BookingSvc = service.NewBookingService(
			c.BookingRepo, c.ExpRepo, c.UserRepo, c.Redis,
		)
	}

	// External-API services. Fallback/mock behavior is controlled by config so
	// production can fail fast instead of silently serving demo data.
	c.PlacesSvc = service.NewGoongPlacesServiceWithFallback(cfg.Goong.APIKey, cfg.App.AllowMockServices)
	c.AISvc = service.NewAITripPlannerServiceWithFallback(cfg.AI.GeminiAPIKey, cfg.App.AllowMockServices)
	c.VNPaySvc = service.NewVNPayServiceWithFallback(
		cfg.VNPay.TmnCode,
		cfg.VNPay.HashSecret,
		cfg.VNPay.ReturnURL,
		cfg.VNPay.Sandbox,
		cfg.App.AllowMockServices,
	)
	c.NotifSvc = service.NewNotificationService(cfg.FCM.ServerKey, c.Pool)
	c.SearchSvc = service.NewSearchServiceWithFallback(
		cfg.Meilisearch.URL,
		cfg.Meilisearch.MasterKey,
		cfg.App.AllowMockServices,
	)
	if c.Pool != nil {
		c.SearchSvc.SyncFromDB(ctx, c.Pool)
	}
	c.UploadSvc = service.NewFileUploadServiceWithFallback(
		cfg.MinIO.Endpoint, cfg.MinIO.User, cfg.MinIO.Password,
		cfg.MinIO.Bucket, cfg.MinIO.UseSSL,
		cfg.App.AllowMockServices,
	)
	c.WeatherSvc = service.NewWeatherServiceWithFallback(cfg.OpenWeather.APIKey, cfg.App.AllowMockServices)

	slog.Info("All services initialized")
}

func (c *Container) initHandlers() {
	// Always-available handlers
	c.HealthH = handler.NewHealthHandler(c.Pool, c.Redis)
	c.PlaceH = handler.NewPlaceHandler(c.PlacesSvc)
	c.AIH = handler.NewAIHandler(c.AISvc)
	c.NotifH = handler.NewNotificationHandler(c.NotifSvc, c.Pool, c.Config.App.AllowMockServices)
	c.AdminH = handler.NewAdminHandler(
		c.Pool,
		c.AdminSettingsRepo,
		c.Config,
		c.AISvc,
		c.VNPaySvc,
		c.NotifSvc,
		c.SearchSvc,
		c.UploadSvc,
	)
	c.SearchH = handler.NewSearchHandler(c.SearchSvc)
	c.DocsH = handler.NewDocsHandler()
	c.UploadH = handler.NewUploadHandler(c.UploadSvc)

	// DB-dependent handlers
	if c.AuthSvc != nil {
		c.AuthH = handler.NewAuthHandler(c.AuthSvc, c.UserPrefRepo)
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
	c.PaymentH = handler.NewPaymentHandler(c.VNPaySvc, c.BookingRepo, c.UserRepo)
	if c.UserRepo != nil && c.ExpRepo != nil && c.BookingRepo != nil {
		c.AdminMgmtH = handler.NewAdminManagementHandler(c.UserRepo, c.ExpRepo, c.BookingRepo, c.ReviewRepo, c.StoryRepo)
	}
	if c.FriendRepo != nil {
		c.FriendH = handler.NewFriendHandler(c.FriendRepo)
	}
	if c.TripRepo != nil {
		c.TripH = handler.NewTripHandler(c.TripRepo, c.ChatRepo, c.GuideRepo, c.FriendRepo)
	}
	if c.ReactionRepo != nil {
		c.ReactionH = handler.NewReactionHandler(c.ReactionRepo)
	}

	// Always-available (weather)
	c.WeatherH = handler.NewWeatherHandler(c.WeatherSvc)

	// DB-dependent (promo, gamification)
	if c.PromoRepo != nil {
		c.PromoH = handler.NewPromotionHandler(c.PromoRepo)
	}
	if c.GamRepo != nil {
		c.GamH = handler.NewGamificationHandler(c.GamRepo)
	}
	if c.BlogRepo != nil {
		c.BlogH = handler.NewBlogHandler(c.BlogRepo)
	}
	if c.DiaryRepo != nil {
		c.DiaryH = handler.NewDiaryHandler(c.DiaryRepo)
	}
	if c.EventRepo != nil {
		c.EventH = handler.NewEventHandler(c.EventRepo)
	}
	if c.SOSRepo != nil {
		c.SOSH = handler.NewSOSHandler(c.SOSRepo)
	}
	c.TranslateH = handler.NewTranslationHandler()
	c.TranslateNewH = handler.NewTranslateHandler()
	if c.ReportRepo != nil {
		c.ReportH = handler.NewReportBlockHandler(c.ReportRepo)
	}
	if c.GuideAppRepo != nil {
		c.GuideAppH = handler.NewGuideAppHandler(c.GuideAppRepo)
	}
	if c.StoryRepo != nil {
		c.StoryH = handler.NewStoryHandler(c.StoryRepo)
	}
	if c.CollectionRepo != nil {
		c.CollectionH = handler.NewCollectionHandler(c.CollectionRepo)
	}

	slog.Info("All handlers initialized")
}

func (c *Container) applyAdminRuntimeSettings(ctx context.Context) {
	if c.AdminH == nil || c.AdminSettingsRepo == nil {
		return
	}

	if err := c.AdminH.ApplyStoredSettings(ctx); err != nil {
		slog.Warn("Failed to apply stored admin runtime settings", "error", err)
		return
	}

	slog.Info("Stored admin runtime settings applied")
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
