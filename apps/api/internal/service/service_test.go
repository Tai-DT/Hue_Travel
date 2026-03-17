package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
)

// ============================================
// Search Service Tests
// ============================================

func TestSearchService_Search(t *testing.T) {
	svc := NewSearchService("", "")

	tests := []struct {
		name     string
		query    string
		filters  SearchFilters
		wantMin  int
		wantZero bool
	}{
		{
			name:    "search by name - Đại Nội",
			query:   "Đại Nội",
			wantMin: 1,
		},
		{
			name:    "search by category - ẩm thực",
			query:   "ẩm thực",
			wantMin: 1,
		},
		{
			name:    "search by tag - UNESCO",
			query:   "UNESCO",
			wantMin: 1,
		},
		{
			name:    "empty query returns all",
			query:   "",
			wantMin: 5,
		},
		{
			name:     "no results for garbage",
			query:    "xyzabc123notfound",
			wantZero: true,
		},
		{
			name:    "filter by type",
			query:   "",
			filters: SearchFilters{Type: "experience"},
			wantMin: 3,
		},
		{
			name:    "filter by category",
			query:   "",
			filters: SearchFilters{Category: "Di sản"},
			wantMin: 1,
		},
		{
			name:    "combined query + filter",
			query:   "Huế",
			filters: SearchFilters{Type: "place"},
			wantMin: 1,
		},
		{
			name:    "limit results",
			query:   "",
			filters: SearchFilters{Limit: 3},
			wantMin: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := svc.Search(context.Background(), tt.query, tt.filters)
			if err != nil {
				t.Fatalf("Search() unexpected error: %v", err)
			}

			if tt.wantZero && result.TotalCount != 0 {
				t.Errorf("expected 0 results, got %d", result.TotalCount)
			}

			if !tt.wantZero && result.TotalCount < tt.wantMin {
				t.Errorf("expected at least %d results, got %d", tt.wantMin, result.TotalCount)
			}

			if result.Query != tt.query {
				t.Errorf("expected query=%q, got %q", tt.query, result.Query)
			}

			if result.TimeMs < 0 {
				t.Error("TimeMs should be non-negative")
			}
		})
	}
}

func TestSearchService_Suggest(t *testing.T) {
	svc := NewSearchService("", "")

	tests := []struct {
		name    string
		query   string
		wantMin int
	}{
		{"suggest Đại", "Đại", 1},
		{"suggest sông", "sông", 1},
		{"suggest empty", "", 0},
		{"suggest garbage", "xyznoexist", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			suggestions, err := svc.Suggest(context.Background(), tt.query, 5)
			if err != nil {
				t.Fatalf("Suggest() unexpected error: %v", err)
			}
			if len(suggestions) < tt.wantMin {
				t.Errorf("expected at least %d suggestions, got %d", tt.wantMin, len(suggestions))
			}
		})
	}
}

func TestSearchService_Trending(t *testing.T) {
	svc := NewSearchService("", "")

	trending, err := svc.Trending(context.Background())
	if err != nil {
		t.Fatalf("Trending() unexpected error: %v", err)
	}
	if len(trending) == 0 {
		t.Error("expected non-empty trending list")
	}

	// Should contain well-known Huế places
	found := false
	for _, item := range trending {
		if item == "Đại Nội Huế" {
			found = true
		}
	}
	if !found {
		t.Error("expected trending to contain 'Đại Nội Huế'")
	}
}

func TestSearchService_IndexStats(t *testing.T) {
	svc := NewSearchService("", "")

	stats, err := svc.GetStats(context.Background())
	if err != nil {
		t.Fatalf("GetStats() unexpected error: %v", err)
	}
	if stats["total"] == 0 {
		t.Error("expected non-zero total documents")
	}
	if stats["experience"] == 0 {
		t.Error("expected indexed experiences")
	}
	if stats["place"] == 0 {
		t.Error("expected indexed places")
	}
}

func TestSearchService_Facets(t *testing.T) {
	svc := NewSearchService("", "")

	result, err := svc.Search(context.Background(), "", SearchFilters{})
	if err != nil {
		t.Fatalf("Search() unexpected error: %v", err)
	}
	if result.Facets == nil {
		t.Fatal("expected facets to be non-nil")
	}

	if len(result.Facets["type"]) == 0 {
		t.Error("expected type facets")
	}

	if len(result.Facets["category"]) == 0 {
		t.Error("expected category facets")
	}
}

func TestSearchService_StrictSearchHelpersFailWithoutMeilisearch(t *testing.T) {
	svc := NewSearchServiceWithFallback("", "", false)

	if _, err := svc.Suggest(context.Background(), "Huế", 5); !errors.Is(err, ErrServiceNotConfigured) {
		t.Fatalf("expected ErrServiceNotConfigured from Suggest, got %v", err)
	}

	if _, err := svc.Trending(context.Background()); !errors.Is(err, ErrServiceNotConfigured) {
		t.Fatalf("expected ErrServiceNotConfigured from Trending, got %v", err)
	}

	if _, err := svc.GetStats(context.Background()); !errors.Is(err, ErrServiceNotConfigured) {
		t.Fatalf("expected ErrServiceNotConfigured from GetStats, got %v", err)
	}
}

func TestGoongPlacesService_StrictModeRequiresAPIKey(t *testing.T) {
	svc := NewGoongPlacesServiceWithFallback("", false)

	if _, err := svc.TextSearch(context.Background(), "Đại Nội", 16.4637, 107.5909); !errors.Is(err, ErrServiceNotConfigured) {
		t.Fatalf("expected ErrServiceNotConfigured from TextSearch, got %v", err)
	}

	if _, err := svc.NearbySearch(context.Background(), 16.4637, 107.5909, 2000, "restaurant"); !errors.Is(err, ErrServiceNotConfigured) {
		t.Fatalf("expected ErrServiceNotConfigured from NearbySearch, got %v", err)
	}

	if _, err := svc.GetDirections(context.Background(), 16.4637, 107.5909, 16.4698, 107.5786, "driving"); !errors.Is(err, ErrServiceNotConfigured) {
		t.Fatalf("expected ErrServiceNotConfigured from GetDirections, got %v", err)
	}
}

// ============================================
// Notification Service Tests
// ============================================

func TestNotificationService_SendBookingConfirmed(t *testing.T) {
	svc := NewNotificationService("", nil)

	// Should not panic — mock mode
	svc.SendBookingConfirmed(context.Background(), uuid.New(), "HT-A1B2", "Đại Nội Huế")
}

func TestNotificationService_GetMockNotifications(t *testing.T) {
	svc := NewNotificationService("", nil)
	userID := uuid.New()

	notifs := svc.GetMockNotifications(userID)
	if len(notifs) == 0 {
		t.Error("expected non-empty mock notifications")
	}

	for _, n := range notifs {
		if n.UserID != userID {
			t.Errorf("expected userID=%s, got %s", userID, n.UserID)
		}
		if n.Title == "" {
			t.Error("notification title should not be empty")
		}
		if n.Body == "" {
			t.Error("notification body should not be empty")
		}
		if n.Type == "" {
			t.Error("notification type should not be empty")
		}
	}

	// Check unread count
	unread := 0
	for _, n := range notifs {
		if !n.IsRead {
			unread++
		}
	}
	if unread == 0 {
		t.Error("expected some unread notifications")
	}
}

func TestNotificationService_IsConfigured(t *testing.T) {
	mockSvc := NewNotificationService("", nil)
	if mockSvc.IsConfigured() {
		t.Error("expected not configured without key")
	}

	configuredSvc := NewNotificationService("some-key", nil)
	if !configuredSvc.IsConfigured() {
		t.Error("expected configured with key")
	}
}

func TestFormatVND(t *testing.T) {
	tests := []struct {
		input    int64
		expected string
	}{
		{0, "0"},
		{100, "100"},
		{1000, "1,000"},
		{750000, "750,000"},
		{1500000, "1,500,000"},
		{456800000, "456,800,000"},
	}

	for _, tt := range tests {
		result := formatVND(tt.input)
		if result != tt.expected {
			t.Errorf("formatVND(%d) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

// ============================================
// File Upload Service Tests
// ============================================

func TestFileUploadService_NotConfigured(t *testing.T) {
	svc := NewFileUploadService("", "", "", "", false)
	if svc.client != nil {
		t.Error("expected nil client when not configured")
	}
}

func TestFileUploadService_ValidateUpload(t *testing.T) {
	svc := NewFileUploadService("", "", "", "", false)

	tests := []struct {
		name         string
		filename     string
		size         int64
		allowedTypes []string
		wantErr      bool
	}{
		{"valid jpg", "photo.jpg", 1024, nil, false},
		{"valid png", "avatar.png", 2048, nil, false},
		{"valid webp", "image.webp", 4096, nil, false},
		{"too large", "huge.jpg", 11 * 1024 * 1024, nil, true},
		{"unsupported type", "doc.pdf", 1024, nil, true},
		{"custom allowed", "doc.pdf", 1024, []string{".pdf"}, false},
		{"custom not allowed", "photo.jpg", 1024, []string{".pdf"}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := svc.ValidateUpload(tt.filename, tt.size, tt.allowedTypes)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateUpload() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestFileUploadService_GenerateKey(t *testing.T) {
	svc := NewFileUploadService("", "", "", "", false)

	key := svc.GenerateKey("avatars", "my photo.jpg")
	if key == "" {
		t.Error("expected non-empty key")
	}
	if !contains(key, "avatars/") {
		t.Errorf("expected key to start with folder, got: %s", key)
	}
	if !contains(key, ".jpg") {
		t.Errorf("expected key to end with .jpg, got: %s", key)
	}
}

func TestFileUploadService_GetPublicURL(t *testing.T) {
	svc := NewFileUploadService("localhost:9000", "", "", "test-bucket", false)
	url := svc.GetPublicURL("avatars/test.jpg")
	if url != "http://localhost:9000/test-bucket/avatars/test.jpg" {
		t.Errorf("unexpected URL: %s", url)
	}

	svc2 := NewFileUploadService("s3.example.com", "", "", "prod-bucket", true)
	url2 := svc2.GetPublicURL("uploads/photo.png")
	if url2 != "https://s3.example.com/prod-bucket/uploads/photo.png" {
		t.Errorf("unexpected URL: %s", url2)
	}
}

func TestFileUploadService_MockUpload(t *testing.T) {
	svc := NewFileUploadService("", "", "", "test", false)

	result, err := svc.Upload(context.Background(), "test", "photo.jpg", nil, 1024)
	if err != nil {
		t.Errorf("expected no error in mock mode, got: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.FileName != "photo.jpg" {
		t.Errorf("expected filename=photo.jpg, got %s", result.FileName)
	}
	if result.FileSize != 1024 {
		t.Errorf("expected size=1024, got %d", result.FileSize)
	}
	if result.MimeType != "image/jpeg" {
		t.Errorf("expected mime=image/jpeg, got %s", result.MimeType)
	}
}

func TestFileUploadService_StrictModeReturnsNotConfiguredWithoutStorage(t *testing.T) {
	svc := NewFileUploadServiceWithFallback("", "", "", "", false, false)

	if _, err := svc.Upload(context.Background(), "test", "photo.jpg", strings.NewReader("data"), 4); !errors.Is(err, ErrServiceNotConfigured) {
		t.Fatalf("expected ErrServiceNotConfigured from Upload, got %v", err)
	}

	if err := svc.Delete(context.Background(), "avatars/test.jpg"); !errors.Is(err, ErrServiceNotConfigured) {
		t.Fatalf("expected ErrServiceNotConfigured from Delete, got %v", err)
	}
}

func TestGetMimeType(t *testing.T) {
	tests := []struct {
		filename string
		expected string
	}{
		{"photo.jpg", "image/jpeg"},
		{"photo.JPEG", "image/jpeg"},
		{"icon.png", "image/png"},
		{"anim.gif", "image/gif"},
		{"modern.webp", "image/webp"},
		{"video.mp4", "video/mp4"},
		{"clip.mov", "video/quicktime"},
		{"unknown.xyz", "application/octet-stream"},
	}
	for _, tt := range tests {
		result := getMimeType(tt.filename)
		if result != tt.expected {
			t.Errorf("getMimeType(%s) = %q, want %q", tt.filename, result, tt.expected)
		}
	}
}

// ============================================
// Notification Service — All send methods
// ============================================

func TestNotificationService_AllSendMethods(t *testing.T) {
	svc := NewNotificationService("", nil)
	ctx := context.Background()
	uid := uuid.New()

	// None of these should panic in mock mode
	svc.SendBookingConfirmed(ctx, uid, "HT-001", "Tour Ẩm Thực")
	svc.SendBookingReminder(ctx, uid, "Tour Đại Nội", "09:00")
	svc.SendNewMessage(ctx, uid, "Nguyễn Văn A", "Chào bạn!")
	svc.SendPaymentSuccess(ctx, uid, 750000, "HT-001")
	svc.SendNewReview(ctx, uid, "Trần B", 5)
	svc.SendLevelUp(ctx, uid, "Explorer", 500)
	svc.SendPromotion(ctx, uid, "Ưu đãi tháng 3", "Giảm 20% tour ẩm thực")
}

// helper
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsStr(s, substr))
}

func containsStr(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
