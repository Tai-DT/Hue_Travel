package service

import (
	"context"
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
			result := svc.Search(context.Background(), tt.query, tt.filters)

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
			suggestions := svc.Suggest(context.Background(), tt.query, 5)
			if len(suggestions) < tt.wantMin {
				t.Errorf("expected at least %d suggestions, got %d", tt.wantMin, len(suggestions))
			}
		})
	}
}

func TestSearchService_Trending(t *testing.T) {
	svc := NewSearchService("", "")

	trending := svc.Trending()
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

	stats := svc.GetStats()
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

	result := svc.Search(context.Background(), "", SearchFilters{})
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
