package app

import (
	"time"

	"github.com/gin-gonic/gin"

	"github.com/huetravel/api/internal/middleware"
	ws "github.com/huetravel/api/internal/websocket"
)

const APIVersion = "1.0.0"

// SetupRouter creates the Gin engine with all middleware and routes registered.
func SetupRouter(c *Container) (*gin.Engine, *ws.Hub) {
	if c.Config.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	// Global middleware
	r.Use(middleware.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.Logger())
	r.Use(middleware.CORS())
	r.Use(middleware.APIVersion(APIVersion))
	r.Use(middleware.RateLimit(100, time.Minute))

	// WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	jwtSecret := c.Config.JWT.Secret

	// Health check
	r.GET("/health", c.HealthH.Check)

	// WebSocket
	r.GET("/ws", middleware.WebSocketAuth(jwtSecret), ws.HandleWebSocket(hub))

	// API v1
	v1 := r.Group("/api/v1")

	registerAuthRoutes(v1, c, jwtSecret)
	registerExperienceRoutes(v1, c, jwtSecret)
	registerPlaceRoutes(v1, c)
	registerBookingRoutes(v1, c, jwtSecret)
	registerReviewRoutes(v1, c, jwtSecret)
	registerFavoriteRoutes(v1, c, jwtSecret)
	registerGuideRoutes(v1, c, jwtSecret)
	registerChatRoutes(v1, c, jwtSecret)
	registerAIRoutes(v1, c)
	registerPaymentRoutes(v1, c, jwtSecret)
	registerNotificationRoutes(v1, c, jwtSecret)
	registerUserProfileRoutes(v1, c, jwtSecret)
	registerUploadRoutes(v1, c, jwtSecret)
	registerAdminRoutes(v1, c, jwtSecret)
	registerSearchRoutes(v1, c)
	registerDocsRoutes(v1, c)

	// Wire WebSocket hub to ChatHandler for real-time broadcast
	if c.ChatH != nil {
		c.ChatH.SetHub(hub)
	}

	return r, hub
}

// ============================================
// Route Registration Functions
// ============================================

func registerAuthRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.AuthH == nil {
		return
	}
	auth := v1.Group("/auth")
	auth.POST("/otp/send", c.AuthH.SendOTP)
	auth.POST("/otp/verify", c.AuthH.VerifyOTP)
	auth.POST("/google", c.AuthH.GoogleLogin)
	auth.POST("/refresh", c.AuthH.RefreshToken)
	auth.POST("/logout", middleware.Auth(jwtSecret), c.AuthH.Logout)
}

func registerExperienceRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.ExpH == nil {
		return
	}
	exp := v1.Group("/experiences")
	exp.GET("", c.ExpH.List)
	exp.GET("/:id", c.ExpH.GetByID)

	authExp := exp.Group("")
	authExp.Use(middleware.Auth(jwtSecret))
	authExp.POST("", middleware.RequireRole("guide", "admin"), c.ExpH.Create)
	authExp.PUT("/:id", middleware.RequireRole("guide", "admin"), c.ExpH.Update)
	authExp.DELETE("/:id", middleware.RequireRole("guide", "admin"), c.ExpH.Delete)
}

func registerPlaceRoutes(v1 *gin.RouterGroup, c *Container) {
	places := v1.Group("/places")
	places.GET("/search", c.PlaceH.Search)
	places.GET("/nearby", c.PlaceH.NearbyRestaurants)
	places.GET("/directions", c.PlaceH.GetDirections)
}

func registerBookingRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.BookingH == nil {
		return
	}
	bookings := v1.Group("/bookings")
	bookings.Use(middleware.Auth(jwtSecret))
	bookings.POST("", c.BookingH.Create)
	bookings.GET("", c.BookingH.List)
	bookings.GET("/:id", c.BookingH.GetByID)
	bookings.POST("/:id/cancel", c.BookingH.Cancel)
	bookings.POST("/:id/confirm", c.BookingH.Confirm)
	bookings.POST("/:id/complete", c.BookingH.Complete)
	bookings.GET("/guide/me", c.BookingH.GuideBookings)
}

func registerReviewRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.ReviewH == nil {
		return
	}
	v1.GET("/experiences/:id/reviews", c.ReviewH.ListByExperience)
	v1.POST("/reviews", middleware.Auth(jwtSecret), c.ReviewH.Create)
}

func registerFavoriteRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.FavH == nil {
		return
	}
	favs := v1.Group("/favorites")
	favs.Use(middleware.Auth(jwtSecret))
	favs.POST("/toggle/:id", c.FavH.Toggle)
	favs.GET("", c.FavH.List)
}

func registerGuideRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.GuideH == nil {
		return
	}
	guides := v1.Group("/guides")
	guides.GET("/top", c.GuideH.TopGuides)
	guides.GET("/:id", c.GuideH.GetProfile)

	guideAuth := v1.Group("/guides")
	guideAuth.Use(middleware.Auth(jwtSecret))
	guideAuth.PUT("/me/profile", middleware.RequireRole("guide", "admin"), c.GuideH.UpdateProfile)
}

func registerChatRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.ChatH == nil {
		return
	}
	chat := v1.Group("/chat")
	chat.Use(middleware.Auth(jwtSecret))
	chat.GET("/rooms", c.ChatH.ListRooms)
	chat.POST("/rooms", c.ChatH.GetOrCreateRoom)
	chat.GET("/rooms/:room_id/messages", c.ChatH.GetMessages)
	chat.POST("/rooms/:room_id/messages", c.ChatH.SendMessage)
	chat.POST("/rooms/:room_id/read", c.ChatH.MarkRead)
}

func registerAIRoutes(v1 *gin.RouterGroup, c *Container) {
	ai := v1.Group("/ai")
	ai.POST("/trip-plan", c.AIH.GenerateTripPlan)
	ai.POST("/chat", c.AIH.Chat)
	ai.GET("/suggest", c.AIH.QuickSuggest)
}

func registerPaymentRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.PaymentH == nil {
		return
	}
	payment := v1.Group("/payment")
	payment.GET("/methods", c.PaymentH.PaymentMethods)
	payment.GET("/callback", c.PaymentH.PaymentCallback)

	paymentAuth := payment.Group("")
	paymentAuth.Use(middleware.Auth(jwtSecret))
	paymentAuth.POST("/create", c.PaymentH.CreatePayment)
}

func registerNotificationRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	notif := v1.Group("/notifications")
	notif.Use(middleware.Auth(jwtSecret))
	notif.GET("", c.NotifH.GetNotifications)
	notif.GET("/unread", c.NotifH.UnreadCount)
	notif.POST("/:id/read", c.NotifH.MarkRead)
	notif.POST("/device", c.NotifH.RegisterDevice)
}

func registerUserProfileRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.AuthH == nil {
		return
	}
	v1.GET("/me", middleware.Auth(jwtSecret), c.AuthH.Me)
	v1.PUT("/me", middleware.Auth(jwtSecret), c.AuthH.UpdateProfile)
	v1.DELETE("/me", middleware.Auth(jwtSecret), c.AuthH.DeleteAccount)
}

func registerUploadRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.UploadH == nil {
		return
	}
	upload := v1.Group("/upload")
	upload.Use(middleware.Auth(jwtSecret))
	upload.POST("", c.UploadH.UploadFile)
	upload.POST("/avatar", c.UploadH.UploadAvatar)
}

func registerAdminRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	admin := v1.Group("/admin")
	admin.Use(middleware.Auth(jwtSecret))
	admin.Use(middleware.RequireRole("admin"))

	admin.GET("/dashboard", c.AdminH.DashboardStats)
	admin.GET("/health", c.AdminH.SystemHealth)
	admin.GET("/quick-stats", c.AdminH.QuickStats)

	if c.AdminMgmtH != nil {
		admin.GET("/users", c.AdminMgmtH.ListUsers)
		admin.GET("/users/:id", c.AdminMgmtH.GetUser)
		admin.PUT("/users/:id/status", c.AdminMgmtH.BanUser)
		admin.PUT("/users/:id/role", c.AdminMgmtH.ChangeRole)

		admin.GET("/experiences", c.AdminMgmtH.ListExperiences)
		admin.DELETE("/experiences/:id", c.AdminMgmtH.DeleteExperience)

		admin.GET("/reviews", c.AdminMgmtH.ListReviews)
		admin.PUT("/reviews/:id/featured", c.AdminMgmtH.ToggleFeaturedReview)
		admin.DELETE("/reviews/:id", c.AdminMgmtH.DeleteReview)

		admin.GET("/bookings", c.AdminMgmtH.ListBookings)
		admin.PUT("/bookings/:id/status", c.AdminMgmtH.UpdateBookingStatus)
	}
}

func registerSearchRoutes(v1 *gin.RouterGroup, c *Container) {
	search := v1.Group("/search")
	search.GET("", c.SearchH.Search)
	search.GET("/suggest", c.SearchH.Suggest)
	search.GET("/trending", c.SearchH.Trending)
	search.GET("/stats", c.SearchH.IndexStats)
}

func registerDocsRoutes(v1 *gin.RouterGroup, c *Container) {
	v1.GET("/docs", c.DocsH.GetDocs)
}
