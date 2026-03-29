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
	r.Use(middleware.SecurityHeaders())
	r.Use(middleware.APIVersion(APIVersion))
	r.Use(middleware.RateLimit(100, time.Minute))
	r.Use(middleware.MaxBodySize(10 * 1024 * 1024)) // 10MB max
	r.Use(middleware.Timeout(30 * time.Second))

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
	registerFriendRoutes(v1, c, jwtSecret)
	registerTripRoutes(v1, c, jwtSecret)
	registerReactionRoutes(v1, c, jwtSecret)
	registerWeatherRoutes(v1, c)
	registerPromotionRoutes(v1, c, jwtSecret)
	registerGamificationRoutes(v1, c, jwtSecret)
	registerBlogRoutes(v1, c, jwtSecret)
	registerDiaryRoutes(v1, c, jwtSecret)
	registerEventRoutes(v1, c, jwtSecret)
	registerSOSRoutes(v1, c, jwtSecret)
	registerTranslationRoutes(v1, c)
	registerReportBlockRoutes(v1, c, jwtSecret)
	registerGuideAppRoutes(v1, c, jwtSecret)
	registerStoryRoutes(v1, c, jwtSecret)
	registerTranslateRoutes(v1, c)
	registerCollectionRoutes(v1, c, jwtSecret)

	// Wire WebSocket hub to ChatHandler for real-time broadcast
	if c.ChatH != nil {
		c.ChatH.SetHub(hub)
	}
	if c.ReactionH != nil {
		c.ReactionH.SetHub(hub)
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
	auth.POST("/register", c.AuthH.Register)
	auth.POST("/login", c.AuthH.LoginWithPassword)
	auth.POST("/refresh", c.AuthH.RefreshToken)
	auth.POST("/logout", middleware.Auth(jwtSecret), c.AuthH.Logout)
	auth.POST("/password", middleware.Auth(jwtSecret), c.AuthH.UpdatePassword)
}

func registerExperienceRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.ExpH == nil {
		return
	}
	exp := v1.Group("/experiences")
	exp.GET("", c.ExpH.List)
	exp.GET("/search", c.ExpH.List) // alias — ?q= search
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
	guides.GET("/:id/direct-booking", c.GuideH.GetDirectBookingExperience)
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
	v1.GET("/me/preferences", middleware.Auth(jwtSecret), c.AuthH.GetPreferences)
	v1.PUT("/me/preferences", middleware.Auth(jwtSecret), c.AuthH.UpdatePreferences)
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
	admin.GET("/settings", c.AdminH.GetSettings)
	admin.PUT("/settings", c.AdminH.SaveSettings)

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
		admin.GET("/stories", c.AdminMgmtH.ListStories)
		admin.DELETE("/stories/:id", c.AdminMgmtH.DeleteStory)
	}

	// Guide Applications (admin)
	if c.GuideAppH != nil {
		admin.GET("/guide-applications", c.GuideAppH.ListPending)
		admin.POST("/guide-applications/:id/approve", c.GuideAppH.Approve)
		admin.POST("/guide-applications/:id/reject", c.GuideAppH.Reject)
	}

	// Reports (admin)
	if c.ReportH != nil {
		admin.GET("/reports", c.ReportH.ListReports)
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

func registerFriendRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.FriendH == nil {
		return
	}
	friends := v1.Group("/friends")
	friends.Use(middleware.Auth(jwtSecret))
	friends.POST("/request", c.FriendH.SendRequest)
	friends.POST("/:id/accept", c.FriendH.AcceptRequest)
	friends.POST("/:id/decline", c.FriendH.DeclineRequest)
	friends.DELETE("/:id", c.FriendH.Unfriend)
	friends.GET("", c.FriendH.ListFriends)
	friends.GET("/pending", c.FriendH.ListPendingRequests)
	friends.GET("/status/:id", c.FriendH.CheckStatus)
}

func registerTripRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.TripH == nil {
		return
	}
	trips := v1.Group("/trips")

	// Public endpoints
	trips.GET("/discover", c.TripH.Discover)

	// Auth required
	tripsAuth := trips.Group("")
	tripsAuth.Use(middleware.Auth(jwtSecret))
	tripsAuth.POST("", c.TripH.Create)
	tripsAuth.GET("", c.TripH.ListMyTrips)
	tripsAuth.GET("/me", c.TripH.ListMyTrips)
	tripsAuth.GET("/invitations", c.TripH.ListInvitations)
	tripsAuth.GET("/:id", c.TripH.GetByID)
	tripsAuth.POST("/:id/invite", c.TripH.InviteMember)
	tripsAuth.POST("/:id/invite-guide", c.TripH.InviteGuide)
	tripsAuth.POST("/:id/accept", c.TripH.AcceptInvite)
	tripsAuth.POST("/:id/decline", c.TripH.DeclineInvite)
	tripsAuth.POST("/:id/join", c.TripH.JoinPublic)
	tripsAuth.POST("/:id/leave", c.TripH.Leave)
	tripsAuth.GET("/:id/guides", c.TripH.SearchGuides)
}

func registerReactionRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.ReactionH == nil {
		return
	}
	reactions := v1.Group("/messages")
	reactions.Use(middleware.Auth(jwtSecret))
	reactions.POST("/:message_id/reactions", c.ReactionH.ToggleReaction)
	reactions.GET("/:message_id/reactions", c.ReactionH.GetReactions)
}

func registerWeatherRoutes(v1 *gin.RouterGroup, c *Container) {
	if c.WeatherH == nil {
		return
	}
	weather := v1.Group("/weather")
	weather.GET("/current", c.WeatherH.GetCurrent)
	weather.GET("/forecast", c.WeatherH.GetForecast)
	weather.GET("/best-time", c.WeatherH.GetBestTime)
}

func registerPromotionRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.PromoH == nil {
		return
	}
	promos := v1.Group("/promotions")

	// Public
	promos.GET("/active", c.PromoH.ListActive)

	// Auth required
	promosAuth := promos.Group("")
	promosAuth.Use(middleware.Auth(jwtSecret))
	promosAuth.POST("", c.PromoH.Create)
	promosAuth.POST("/apply", c.PromoH.Apply)
	promosAuth.GET("/my-coupons", c.PromoH.MyCoupons)
}

func registerGamificationRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.GamH == nil {
		return
	}

	// Public
	v1.GET("/achievements", c.GamH.ListAchievements)
	v1.GET("/leaderboard", c.GamH.GetLeaderboard)

	// Auth required
	gam := v1.Group("")
	gam.Use(middleware.Auth(jwtSecret))
	gam.GET("/achievements/my", c.GamH.MyAchievements)
	gam.POST("/checkin", c.GamH.CheckIn)
	gam.GET("/checkins", c.GamH.GetCheckins)
	gam.GET("/gamification/stats", c.GamH.GetMyStats)
}

func registerBlogRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.BlogH == nil {
		return
	}
	blog := v1.Group("/blog")

	// Public
	blog.GET("/posts", c.BlogH.List)
	blog.GET("/posts/:slug", c.BlogH.GetBySlug)
	blog.GET("/trending", c.BlogH.Trending)

	// Separate group for post actions by ID
	blogActions := v1.Group("/blog-posts")
	blogActions.GET("/:id/comments", c.BlogH.ListComments)

	// Auth
	blogAuth := blogActions.Group("")
	blogAuth.Use(middleware.Auth(jwtSecret))
	blog.POST("/posts", middleware.Auth(jwtSecret), c.BlogH.Create)
	blogAuth.POST("/:id/like", c.BlogH.ToggleLike)
	blogAuth.POST("/:id/comments", c.BlogH.AddComment)
}

func registerDiaryRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.DiaryH == nil {
		return
	}

	// Public
	v1.GET("/diary/public", c.DiaryH.ListPublic)

	// Auth
	diary := v1.Group("/diary")
	diary.Use(middleware.Auth(jwtSecret))
	diary.POST("/entries", c.DiaryH.Create)
	diary.GET("/entries", c.DiaryH.ListMine)
}

func registerEventRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.EventH == nil {
		return
	}
	events := v1.Group("/events")

	// Public
	events.GET("", c.EventH.ListUpcoming)
	events.GET("/:id", c.EventH.GetByID)

	// Auth
	eventsAuth := events.Group("")
	eventsAuth.Use(middleware.Auth(jwtSecret))
	eventsAuth.POST("/:id/rsvp", c.EventH.RSVP)
}

func registerSOSRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.SOSH == nil {
		return
	}
	sos := v1.Group("/emergency")

	// Public
	sos.GET("/contacts", c.SOSH.GetContacts)
	sos.GET("/hospitals", c.SOSH.GetNearbyHospitals)

	// Auth
	sosAuth := sos.Group("")
	sosAuth.Use(middleware.Auth(jwtSecret))
	sosAuth.POST("/sos", c.SOSH.SendSOS)
	sosAuth.POST("/sos/:id/cancel", c.SOSH.CancelSOS)
}

func registerTranslationRoutes(v1 *gin.RouterGroup, c *Container) {
	if c.TranslateH == nil {
		return
	}
	v1.GET("/phrasebook", c.TranslateH.GetPhrasebook)
}

// ============================================
// NEW FEATURES
// ============================================

func registerReportBlockRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.ReportH == nil {
		return
	}
	rpt := v1.Group("/reports")
	rpt.Use(middleware.Auth(jwtSecret))
	rpt.POST("", c.ReportH.CreateReport)

	block := v1.Group("/block")
	block.Use(middleware.Auth(jwtSecret))
	block.POST("", c.ReportH.BlockUser)
	block.DELETE("/:id", c.ReportH.UnblockUser)
	block.GET("", c.ReportH.ListBlocked)
}

func registerGuideAppRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.GuideAppH == nil {
		return
	}
	ga := v1.Group("/guide-apply")
	ga.Use(middleware.Auth(jwtSecret))
	ga.POST("", c.GuideAppH.Apply)
	ga.GET("/my", c.GuideAppH.MyApplication)
}

func registerStoryRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.StoryH == nil {
		return
	}
	feed := v1.Group("/feed")

	// Public — anyone can browse the feed
	feed.GET("", c.StoryH.Feed)
	feed.GET("/:id/comments", c.StoryH.ListComments)

	// Auth required — posting, liking, commenting, deleting
	feedAuth := feed.Group("")
	feedAuth.Use(middleware.Auth(jwtSecret))
	feedAuth.POST("", c.StoryH.Create)
	feedAuth.POST("/:id/like", c.StoryH.Like)
	feedAuth.POST("/:id/comment", c.StoryH.Comment)
	feedAuth.DELETE("/:id", c.StoryH.Delete)
}

func registerTranslateRoutes(v1 *gin.RouterGroup, c *Container) {
	if c.TranslateNewH == nil {
		return
	}
	v1.POST("/translate", c.TranslateNewH.Translate)
	v1.POST("/translate/detect", c.TranslateNewH.DetectLanguage)
}

func registerCollectionRoutes(v1 *gin.RouterGroup, c *Container, jwtSecret string) {
	if c.CollectionH == nil {
		return
	}
	col := v1.Group("/collections")
	col.Use(middleware.Auth(jwtSecret))
	col.POST("", c.CollectionH.Create)
	col.GET("", c.CollectionH.List)
	col.POST("/:id/items", c.CollectionH.AddItem)
	col.GET("/:id/items", c.CollectionH.GetItems)
	col.DELETE("/:id/items/:item_id", c.CollectionH.RemoveItem)
	col.DELETE("/:id", c.CollectionH.Delete)
}
