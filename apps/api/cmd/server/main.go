package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/huetravel/api/internal/app"
	"github.com/huetravel/api/internal/config"
)

func main() {
	// Setup structured logging
	setupLogger()

	ctx := context.Background()

	// Load config
	cfg, err := config.Load()
	if err != nil {
		slog.Error("Failed to load config", "error", err)
		os.Exit(1)
	}
	if err := cfg.Validate(); err != nil {
		slog.Error("Invalid configuration", "error", err)
		os.Exit(1)
	}

	// Initialize DI container (repos, services, handlers)
	container := app.NewContainer(ctx, cfg)
	defer container.Close()

	// Setup router with all routes
	router, hub := app.SetupRouter(container)
	defer hub.Stop()

	// Print startup banner
	printBanner(container)

	// Create HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.App.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		slog.Info("Server starting", "port", cfg.App.Port, "env", cfg.App.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal (graceful shutdown)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	slog.Info("Shutting down gracefully", "signal", sig.String())

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("Server exited gracefully")
}

func setupLogger() {
	env := os.Getenv("APP_ENV")

	var handler slog.Handler
	if env == "production" {
		// JSON logs for production (structured, machine-readable)
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelInfo,
		})
	} else {
		// Text logs for development (human-readable)
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelDebug,
		})
	}

	slog.SetDefault(slog.New(handler))
}

func printBanner(c *app.Container) {
	dbStatus := "❌ disconnected"
	redisStatus := "❌ disconnected"
	if c.DBConnected {
		dbStatus = "✅ connected"
	}
	if c.RedisConnected {
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
`, app.APIVersion, c.Config.App.Env, c.Config.App.Port, dbStatus, redisStatus)
}
