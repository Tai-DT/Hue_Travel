package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================
// Notification Service
// Saves to DB + optionally pushes via FCM
// ============================================

type NotificationService struct {
	fcmServerKey string
	pool         *pgxpool.Pool
	mu           sync.RWMutex
}

func NewNotificationService(fcmServerKey string, pool *pgxpool.Pool) *NotificationService {
	return &NotificationService{fcmServerKey: fcmServerKey, pool: pool}
}

func (s *NotificationService) IsConfigured() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return strings.TrimSpace(s.fcmServerKey) != ""
}

func (s *NotificationService) UpdateConfig(serverKey string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.fcmServerKey = serverKey
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
	NotifBookingConfirmed NotificationType = "booking_confirmed"
	NotifBookingCancelled NotificationType = "booking_cancelled"
	NotifBookingReminder  NotificationType = "booking_reminder"
	NotifNewMessage       NotificationType = "new_message"
	NotifNewReview        NotificationType = "new_review"
	NotifPaymentSuccess   NotificationType = "payment_success"
	NotifPaymentFailed    NotificationType = "payment_failed"
	NotifGuideAccepted    NotificationType = "guide_accepted"
	NotifLevelUp          NotificationType = "level_up"
	NotifPromotion        NotificationType = "promotion"
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

	s.mu.RLock()
	serverKey := s.fcmServerKey
	s.mu.RUnlock()

	if strings.TrimSpace(serverKey) == "" {
		log.Printf("📣 [NOTIF] FCM not configured, saved to DB/log only. To=%s | %s: %s — %s",
			notif.UserID.String()[:8], notif.Type, notif.Title, notif.Body)
		return
	}

	if !s.shouldPush(ctx, notif) {
		log.Printf("📣 [NOTIF] Push skipped by user preferences. To=%s | %s", notif.UserID.String()[:8], notif.Type)
		return
	}

	// Real FCM push notification
	s.pushFCM(ctx, notif, serverKey)
}

func (s *NotificationService) shouldPush(ctx context.Context, notif Notification) bool {
	if s.pool == nil {
		return true
	}

	var pushEnabled bool
	var chatEnabled bool
	var promoEnabled bool
	err := s.pool.QueryRow(ctx, `
		SELECT push_notifications_enabled, chat_notifications_enabled, promo_notifications_enabled
		FROM user_preferences
		WHERE user_id = $1`,
		notif.UserID,
	).Scan(&pushEnabled, &chatEnabled, &promoEnabled)
	if err == pgx.ErrNoRows {
		return notif.Type != NotifPromotion
	}
	if err != nil {
		log.Printf("⚠️ Failed to read notification preferences: %v", err)
		return true
	}

	if !pushEnabled {
		return false
	}

	switch notif.Type {
	case NotifNewMessage:
		return chatEnabled
	case NotifPromotion:
		return promoEnabled
	default:
		return true
	}
}

// pushFCM sends a real push notification via Firebase Cloud Messaging Legacy HTTP API
func (s *NotificationService) pushFCM(ctx context.Context, notif Notification, serverKey string) {
	if s.pool == nil {
		return
	}

	// Get device token(s) for user
	rows, err := s.pool.Query(ctx,
		`SELECT fcm_token FROM device_tokens WHERE user_id = $1`, notif.UserID)
	if err != nil {
		log.Printf("⚠️ FCM: failed to get device tokens: %v", err)
		return
	}
	defer rows.Close()

	var tokens []string
	for rows.Next() {
		var token string
		rows.Scan(&token)
		tokens = append(tokens, token)
	}

	if len(tokens) == 0 {
		log.Printf("📣 [FCM] No device tokens for user %s — notification saved to DB only", notif.UserID.String()[:8])
		return
	}

	// Send to each device token
	for _, token := range tokens {
		payload := map[string]interface{}{
			"to": token,
			"notification": map[string]string{
				"title": notif.Title,
				"body":  notif.Body,
				"sound": "default",
			},
			"data": map[string]interface{}{
				"type":            string(notif.Type),
				"notification_id": notif.ID.String(),
			},
		}
		if notif.Data != nil {
			for k, v := range notif.Data {
				payload["data"].(map[string]interface{})[k] = v
			}
		}

		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequestWithContext(ctx, "POST", "https://fcm.googleapis.com/fcm/send", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "key="+serverKey)

		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			log.Printf("⚠️ FCM send failed: %v", err)
			continue
		}
		resp.Body.Close()

		if resp.StatusCode == 200 {
			log.Printf("📣 [FCM] Sent to %s: %s", notif.UserID.String()[:8], notif.Title)
		} else {
			log.Printf("⚠️ FCM returned status %d for user %s", resp.StatusCode, notif.UserID.String()[:8])
		}
	}
}

// ============================================
// Mock: Get user notifications (fallback when DB is nil)
// ============================================

func (s *NotificationService) GetMockNotifications(userID uuid.UUID) []Notification {
	now := time.Now()
	return []Notification{
		{
			ID: uuid.New(), UserID: userID, Type: NotifBookingConfirmed,
			Title:  "✅ Booking đã xác nhận!",
			Body:   "Booking HT-A1B2C3 cho \"Khám phá Đại Nội Huế\" đã được xác nhận.",
			IsRead: false, CreatedAt: now.Add(-30 * time.Minute),
		},
		{
			ID: uuid.New(), UserID: userID, Type: NotifNewMessage,
			Title:  "💬 Nguyễn Văn Minh",
			Body:   "Chào bạn! Mình sẽ đón bạn lúc 9h sáng nhé 🙌",
			IsRead: false, CreatedAt: now.Add(-2 * time.Hour),
		},
		{
			ID: uuid.New(), UserID: userID, Type: NotifPaymentSuccess,
			Title:  "💳 Thanh toán thành công!",
			Body:   "Bạn đã thanh toán 750,000₫ cho booking HT-A1B2C3.",
			IsRead: true, CreatedAt: now.Add(-4 * time.Hour),
		},
		{
			ID: uuid.New(), UserID: userID, Type: NotifLevelUp,
			Title:  "🎉 Lên cấp!",
			Body:   "Chúc mừng! Bạn đã đạt cấp \"Adventurer\" với 150 XP!",
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
