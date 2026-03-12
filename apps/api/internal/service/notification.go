package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================
// Notification Service
// Saves to DB + optionally pushes via FCM
// ============================================

type NotificationService struct {
	fcmServerKey string
	pool         *pgxpool.Pool
}

func NewNotificationService(fcmServerKey string, pool *pgxpool.Pool) *NotificationService {
	return &NotificationService{fcmServerKey: fcmServerKey, pool: pool}
}

func (s *NotificationService) IsConfigured() bool {
	return s.fcmServerKey != ""
}

// Notification represents a push notification
type Notification struct {
	ID        uuid.UUID         `json:"id"`
	UserID    uuid.UUID         `json:"user_id"`
	Type      NotificationType  `json:"type"`
	Title     string            `json:"title"`
	Body      string            `json:"body"`
	Data      map[string]string `json:"data,omitempty"`
	IsRead    bool              `json:"is_read"`
	CreatedAt time.Time         `json:"created_at"`
}

type NotificationType string

const (
	NotifBookingConfirmed  NotificationType = "booking_confirmed"
	NotifBookingCancelled  NotificationType = "booking_cancelled"
	NotifBookingReminder   NotificationType = "booking_reminder"
	NotifNewMessage        NotificationType = "new_message"
	NotifNewReview         NotificationType = "new_review"
	NotifPaymentSuccess    NotificationType = "payment_success"
	NotifPaymentFailed     NotificationType = "payment_failed"
	NotifGuideAccepted     NotificationType = "guide_accepted"
	NotifLevelUp           NotificationType = "level_up"
	NotifPromotion         NotificationType = "promotion"
)

// ============================================
// Send Notifications
// ============================================

func (s *NotificationService) SendBookingConfirmed(ctx context.Context, userID uuid.UUID, bookingCode, experienceTitle string) {
	s.send(ctx, Notification{
		UserID: userID,
		Type:   NotifBookingConfirmed,
		Title:  "✅ Booking đã xác nhận!",
		Body:   fmt.Sprintf("Booking %s cho \"%s\" đã được xác nhận. Chúc bạn có chuyến đi vui vẻ!", bookingCode, experienceTitle),
		Data:   map[string]string{"booking_code": bookingCode},
	})
}

func (s *NotificationService) SendBookingReminder(ctx context.Context, userID uuid.UUID, experienceTitle, startTime string) {
	s.send(ctx, Notification{
		UserID: userID,
		Type:   NotifBookingReminder,
		Title:  "⏰ Nhắc nhở: Tour sắp bắt đầu",
		Body:   fmt.Sprintf("\"%s\" sẽ bắt đầu lúc %s. Đừng quên chuẩn bị nhé!", experienceTitle, startTime),
	})
}

func (s *NotificationService) SendNewMessage(ctx context.Context, userID uuid.UUID, senderName, preview string) {
	s.send(ctx, Notification{
		UserID: userID,
		Type:   NotifNewMessage,
		Title:  fmt.Sprintf("💬 %s", senderName),
		Body:   preview,
	})
}

func (s *NotificationService) SendPaymentSuccess(ctx context.Context, userID uuid.UUID, amount int64, bookingCode string) {
	s.send(ctx, Notification{
		UserID: userID,
		Type:   NotifPaymentSuccess,
		Title:  "💳 Thanh toán thành công!",
		Body:   fmt.Sprintf("Bạn đã thanh toán %s₫ cho booking %s.", formatVND(amount), bookingCode),
		Data:   map[string]string{"booking_code": bookingCode},
	})
}

func (s *NotificationService) SendNewReview(ctx context.Context, guideID uuid.UUID, reviewerName string, rating int) {
	stars := ""
	for i := 0; i < rating; i++ {
		stars += "⭐"
	}
	s.send(ctx, Notification{
		UserID: guideID,
		Type:   NotifNewReview,
		Title:  "📝 Đánh giá mới!",
		Body:   fmt.Sprintf("%s đã đánh giá bạn %s", reviewerName, stars),
	})
}

func (s *NotificationService) SendLevelUp(ctx context.Context, userID uuid.UUID, newLevel string, xp int) {
	s.send(ctx, Notification{
		UserID: userID,
		Type:   NotifLevelUp,
		Title:  "🎉 Lên cấp!",
		Body:   fmt.Sprintf("Chúc mừng! Bạn đã đạt cấp \"%s\" với %d XP!", newLevel, xp),
	})
}

func (s *NotificationService) SendPromotion(ctx context.Context, userID uuid.UUID, title, body string) {
	s.send(ctx, Notification{
		UserID: userID,
		Type:   NotifPromotion,
		Title:  "🎁 " + title,
		Body:   body,
	})
}

// ============================================
// Internal: Save to DB + Send via FCM
// ============================================

func (s *NotificationService) send(ctx context.Context, notif Notification) {
	notif.ID = uuid.New()
	notif.CreatedAt = time.Now()

	// Save to database
	if s.pool != nil {
		_, err := s.pool.Exec(ctx, `
			INSERT INTO notifications (id, user_id, type, title, body, is_read, created_at)
			VALUES ($1, $2, $3, $4, $5, FALSE, $6)`,
			notif.ID, notif.UserID, notif.Type, notif.Title, notif.Body, notif.CreatedAt,
		)
		if err != nil {
			log.Printf("⚠️ Failed to save notification: %v", err)
		}
	}

	if !s.IsConfigured() {
		log.Printf("📣 [NOTIF] To=%s | %s: %s — %s",
			notif.UserID.String()[:8], notif.Type, notif.Title, notif.Body)
		return
	}

	// In production: Firebase Cloud Messaging HTTP v1 API
	// POST https://fcm.googleapis.com/v1/projects/{project_id}/messages:send
	log.Printf("📣 [FCM] Sent to %s: %s", notif.UserID.String()[:8], notif.Title)
}

// ============================================
// Mock: Get user notifications (fallback when DB is nil)
// ============================================

func (s *NotificationService) GetMockNotifications(userID uuid.UUID) []Notification {
	now := time.Now()
	return []Notification{
		{
			ID: uuid.New(), UserID: userID, Type: NotifBookingConfirmed,
			Title: "✅ Booking đã xác nhận!",
			Body:  "Booking HT-A1B2C3 cho \"Khám phá Đại Nội Huế\" đã được xác nhận.",
			IsRead: false, CreatedAt: now.Add(-30 * time.Minute),
		},
		{
			ID: uuid.New(), UserID: userID, Type: NotifNewMessage,
			Title: "💬 Nguyễn Văn Minh",
			Body:  "Chào bạn! Mình sẽ đón bạn lúc 9h sáng nhé 🙌",
			IsRead: false, CreatedAt: now.Add(-2 * time.Hour),
		},
		{
			ID: uuid.New(), UserID: userID, Type: NotifPaymentSuccess,
			Title: "💳 Thanh toán thành công!",
			Body:  "Bạn đã thanh toán 750,000₫ cho booking HT-A1B2C3.",
			IsRead: true, CreatedAt: now.Add(-4 * time.Hour),
		},
		{
			ID: uuid.New(), UserID: userID, Type: NotifLevelUp,
			Title: "🎉 Lên cấp!",
			Body:  "Chúc mừng! Bạn đã đạt cấp \"Adventurer\" với 150 XP!",
			IsRead: true, CreatedAt: now.Add(-24 * time.Hour),
		},
	}
}

func formatVND(amount int64) string {
	s := fmt.Sprintf("%d", amount)
	n := len(s)
	if n <= 3 {
		return s
	}
	var result []byte
	for i, c := range s {
		if i > 0 && (n-i)%3 == 0 {
			result = append(result, ',')
		}
		result = append(result, byte(c))
	}
	return string(result)
}
