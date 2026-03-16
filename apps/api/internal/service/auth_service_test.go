package service

import (
	"context"
	"testing"
	"time"

	"github.com/huetravel/api/internal/model"
	"github.com/huetravel/api/internal/testutil"
)

func TestAuthServiceGoogleLoginLinksExistingUserByEmail(t *testing.T) {
	userRepo := testutil.NewMockUserRepo()
	otpRepo := testutil.NewMockOTPRepo()
	authService := NewAuthService(userRepo, otpRepo, nil, nil, "test-secret", time.Hour, 24*time.Hour)

	email := "admin@huetravel.local"
	existingUser := &model.User{
		Email:    &email,
		FullName: "Admin Demo",
		Role:     model.RoleAdmin,
		IsActive: true,
	}
	if err := userRepo.Create(context.Background(), existingUser); err != nil {
		t.Fatalf("Create() unexpected error: %v", err)
	}

	originalVerifier := googleTokenVerifier
	googleTokenVerifier = func(_ string) (*GoogleUser, error) {
		return &GoogleUser{
			ID:            "google-admin-123",
			Email:         email,
			Name:          "Admin Demo",
			Picture:       "https://example.com/avatar.png",
			EmailVerified: "true",
		}, nil
	}
	defer func() {
		googleTokenVerifier = originalVerifier
	}()

	result, err := authService.GoogleLogin(context.Background(), "valid-google-token")
	if err != nil {
		t.Fatalf("GoogleLogin() unexpected error: %v", err)
	}
	if result == nil || result.User == nil {
		t.Fatal("expected non-nil auth response with user")
	}
	if result.IsNewUser {
		t.Fatal("expected existing user to be linked instead of created")
	}
	if result.User.ID != existingUser.ID {
		t.Fatalf("expected linked user ID %s, got %s", existingUser.ID, result.User.ID)
	}
	if result.User.Role != model.RoleAdmin {
		t.Fatalf("expected role %q, got %q", model.RoleAdmin, result.User.Role)
	}
	if !result.User.IsVerified {
		t.Fatal("expected linked user to be marked verified")
	}
	if result.User.AvatarURL == nil || *result.User.AvatarURL == "" {
		t.Fatal("expected avatar URL to be populated from Google profile")
	}

	linkedUser, err := userRepo.GetByGoogleID(context.Background(), "google-admin-123")
	if err != nil {
		t.Fatalf("GetByGoogleID() unexpected error: %v", err)
	}
	if linkedUser == nil {
		t.Fatal("expected google ID to be linked to existing user")
	}
	if linkedUser.ID != existingUser.ID {
		t.Fatalf("expected linked google user ID %s, got %s", existingUser.ID, linkedUser.ID)
	}
}

func TestGoogleClientIDsFromEnv(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_IDS", "web-client, mobile-client , web-client")
	t.Setenv("GOOGLE_CLIENT_ID", "fallback-client")
	t.Setenv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID", "")
	t.Setenv("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID", "")
	t.Setenv("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID", "")

	clientIDs := googleClientIDsFromEnv()
	if len(clientIDs) != 2 {
		t.Fatalf("expected 2 unique client IDs, got %d: %v", len(clientIDs), clientIDs)
	}
	if clientIDs[0] != "web-client" || clientIDs[1] != "mobile-client" {
		t.Fatalf("unexpected client IDs: %#v", clientIDs)
	}
}

func TestIsAllowedGoogleAudienceFallback(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_IDS", "")
	t.Setenv("GOOGLE_CLIENT_ID", "single-client")
	t.Setenv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID", "")
	t.Setenv("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID", "")
	t.Setenv("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID", "")

	if !isAllowedGoogleAudience("single-client") {
		t.Fatal("expected fallback GOOGLE_CLIENT_ID to be allowed")
	}
	if isAllowedGoogleAudience("different-client") {
		t.Fatal("expected unknown audience to be rejected")
	}
}
