package service

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// ============================================
// Background Worker — Periodic cleanup tasks
// ============================================

type BackgroundWorker struct {
	pool   *pgxpool.Pool
	rdb    *redis.Client
	cancel context.CancelFunc
}

func NewBackgroundWorker(pool *pgxpool.Pool, rdb *redis.Client) *BackgroundWorker {
	return &BackgroundWorker{pool: pool, rdb: rdb}
}

// Start launches all periodic background tasks.
// Call Stop() during graceful shutdown.
func (w *BackgroundWorker) Start() {
	ctx, cancel := context.WithCancel(context.Background())
	w.cancel = cancel

	log.Println("🔄 Background worker started")

	// Expired booking cleanup — every 5 minutes
	go w.runPeriodic(ctx, "expired-bookings", 5*time.Minute, w.cleanupExpiredBookings)
}

// Stop cancels all background tasks gracefully.
func (w *BackgroundWorker) Stop() {
	if w.cancel != nil {
		w.cancel()
		log.Println("🛑 Background worker stopped")
	}
}

func (w *BackgroundWorker) runPeriodic(ctx context.Context, name string, interval time.Duration, task func(ctx context.Context) error) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Run once immediately on startup
	if err := task(ctx); err != nil {
		log.Printf("⚠️ [%s] initial run error: %v", name, err)
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := task(ctx); err != nil {
				log.Printf("⚠️ [%s] error: %v", name, err)
			}
		}
	}
}

// cleanupExpiredBookings cancels bookings that have been "pending" for more than 30 minutes
// without payment. This prevents stale bookings from occupying slots indefinitely.
func (w *BackgroundWorker) cleanupExpiredBookings(ctx context.Context) error {
	if w.pool == nil {
		return nil
	}

	result, err := w.pool.Exec(ctx, `
		UPDATE bookings 
		SET status = 'cancelled', 
		    cancelled_at = NOW(), 
		    updated_at = NOW()
		WHERE status = 'pending' 
		  AND paid_at IS NULL
		  AND created_at < NOW() - INTERVAL '30 minutes'`)
	if err != nil {
		return err
	}

	if result.RowsAffected() > 0 {
		log.Printf("🧹 Cleaned up %d expired pending bookings", result.RowsAffected())
	}
	return nil
}
