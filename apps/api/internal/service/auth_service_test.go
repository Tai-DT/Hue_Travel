package service

import (
	"context"
	"testing"
	"time"

	"github.com/huetravel/api/internal/model"
	"github.com/huetravel/api/internal/testutil"
	"golang.org/x/crypto/bcrypt"
)

func TestAuthServiceRegisterAndPasswordLogin(t *testing.T) {
	userRepo := testutil.NewMockUserRepo()
	authService := NewAuthService(userRepo, nil, "test-secret", time.Hour, 24*time.Hour)

	registerResult, err := authService.Register(context.Background(), RegisterRequest{
		FullName: "Tai Nguyen",
		Email:    "tai@example.com",
		Password: "Secret123!",
	})
	if err != nil {
		t.Fatalf("Register() unexpected error: %v", err)
	}
	if registerResult == nil || registerResult.User == nil {
		t.Fatal("expected auth response with created user")
	}
	if !registerResult.IsNewUser {
		t.Fatal("expected register flow to mark user as new")
	}
	if registerResult.User.PasswordHash == nil || *registerResult.User.PasswordHash == "" {
		t.Fatal("expected password hash to be stored for local auth")
	}

	loginResult, err := authService.LoginWithPassword(context.Background(), PasswordLoginRequest{
		Email:    "TAI@example.com",
		Password: "Secret123!",
	})
	if err != nil {
		t.Fatalf("LoginWithPassword() unexpected error: %v", err)
	}
	if loginResult == nil || loginResult.User == nil {
		t.Fatal("expected login response with user")
	}
	if loginResult.User.ID != registerResult.User.ID {
		t.Fatalf("expected same user ID after login, got %s want %s", loginResult.User.ID, registerResult.User.ID)
	}
}

func TestAuthServiceLoginWithPasswordNormalizesEmail(t *testing.T) {
	userRepo := testutil.NewMockUserRepo()
	authService := NewAuthService(userRepo, nil, "test-secret", time.Hour, 24*time.Hour)

	email := "normalize@example.com"
	passwordHashBytes, err := bcrypt.GenerateFromPassword([]byte("Secret123!"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("GenerateFromPassword() unexpected error: %v", err)
	}
	passwordHash := string(passwordHashBytes)

	user := &model.User{
		Email:        &email,
		PasswordHash: &passwordHash,
		FullName:     "Email User",
		Role:         model.RoleTraveler,
		IsActive:     true,
	}
	if err := userRepo.Create(context.Background(), user); err != nil {
		t.Fatalf("Create() unexpected error: %v", err)
	}

	loginResult, err := authService.LoginWithPassword(context.Background(), PasswordLoginRequest{
		Email:    "  NORMALIZE@EXAMPLE.COM ",
		Password: "Secret123!",
	})
	if err != nil {
		t.Fatalf("LoginWithPassword() unexpected error: %v", err)
	}
	if loginResult == nil || loginResult.User == nil {
		t.Fatal("expected login response with user")
	}
	if loginResult.User.ID != user.ID {
		t.Fatalf("expected normalized email login to resolve same user, got %s want %s", loginResult.User.ID, user.ID)
	}
}

func TestAuthServiceLoginWithPasswordRejectsWrongPassword(t *testing.T) {
	userRepo := testutil.NewMockUserRepo()
	authService := NewAuthService(userRepo, nil, "test-secret", time.Hour, 24*time.Hour)

	email := "wrong-pass@example.com"
	passwordHashBytes, err := bcrypt.GenerateFromPassword([]byte("Secret123!"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("GenerateFromPassword() unexpected error: %v", err)
	}
	passwordHash := string(passwordHashBytes)
	user := &model.User{
		Email:        &email,
		PasswordHash: &passwordHash,
		FullName:     "Wrong Pass",
		Role:         model.RoleTraveler,
		IsActive:     true,
	}
	if err := userRepo.Create(context.Background(), user); err != nil {
		t.Fatalf("Create() unexpected error: %v", err)
	}

	if _, err := authService.LoginWithPassword(context.Background(), PasswordLoginRequest{
		Email:    email,
		Password: "not-the-password",
	}); err == nil {
		t.Fatal("expected wrong password to be rejected")
	}
}

func TestAuthServiceUpdatePasswordSetsFirstPasswordWithoutCurrentPassword(t *testing.T) {
	userRepo := testutil.NewMockUserRepo()
	authService := NewAuthService(userRepo, nil, "test-secret", time.Hour, 24*time.Hour)

	email := "first-password@example.com"
	user := &model.User{
		Email:      &email,
		FullName:   "First Password",
		Role:       model.RoleTraveler,
		IsActive:   true,
		IsVerified: true,
	}
	if err := userRepo.Create(context.Background(), user); err != nil {
		t.Fatalf("Create() unexpected error: %v", err)
	}

	if err := authService.UpdatePassword(context.Background(), user.ID, UpdatePasswordRequest{
		NewPassword: "Secret123!",
	}); err != nil {
		t.Fatalf("UpdatePassword() unexpected error: %v", err)
	}

	loginResult, err := authService.LoginWithPassword(context.Background(), PasswordLoginRequest{
		Email:    email,
		Password: "Secret123!",
	})
	if err != nil {
		t.Fatalf("LoginWithPassword() unexpected error after set password: %v", err)
	}
	if loginResult == nil || loginResult.User == nil || !loginResult.User.HasPassword {
		t.Fatal("expected user to have password after first set")
	}
}

func TestAuthServiceUpdatePasswordRequiresCurrentPasswordWhenAlreadySet(t *testing.T) {
	userRepo := testutil.NewMockUserRepo()
	authService := NewAuthService(userRepo, nil, "test-secret", time.Hour, 24*time.Hour)

	email := "rotate-password@example.com"
	passwordHashBytes, err := bcrypt.GenerateFromPassword([]byte("OldSecret123!"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("GenerateFromPassword() unexpected error: %v", err)
	}
	passwordHash := string(passwordHashBytes)
	user := &model.User{
		Email:        &email,
		PasswordHash: &passwordHash,
		HasPassword:  true,
		FullName:     "Rotate Password",
		Role:         model.RoleTraveler,
		IsActive:     true,
	}
	if err := userRepo.Create(context.Background(), user); err != nil {
		t.Fatalf("Create() unexpected error: %v", err)
	}

	if err := authService.UpdatePassword(context.Background(), user.ID, UpdatePasswordRequest{
		NewPassword: "NewSecret123!",
	}); err == nil {
		t.Fatal("expected current password to be required")
	}

	if err := authService.UpdatePassword(context.Background(), user.ID, UpdatePasswordRequest{
		CurrentPassword: "OldSecret123!",
		NewPassword:     "NewSecret123!",
	}); err != nil {
		t.Fatalf("UpdatePassword() unexpected error: %v", err)
	}

	if _, err := authService.LoginWithPassword(context.Background(), PasswordLoginRequest{
		Email:    email,
		Password: "NewSecret123!",
	}); err != nil {
		t.Fatalf("LoginWithPassword() unexpected error with new password: %v", err)
	}
}

func TestAuthServiceUpdatePasswordAllowsLegacyInvalidHashWithoutCurrentPassword(t *testing.T) {
	userRepo := testutil.NewMockUserRepo()
	authService := NewAuthService(userRepo, nil, "test-secret", time.Hour, 24*time.Hour)

	email := "legacy-invalid-hash@example.com"
	legacyHash := "$2a$10$dummy_hash_legacy"
	user := &model.User{
		Email:        &email,
		PasswordHash: &legacyHash,
		FullName:     "Legacy User",
		Role:         model.RoleTraveler,
		IsActive:     true,
	}
	if err := userRepo.Create(context.Background(), user); err != nil {
		t.Fatalf("Create() unexpected error: %v", err)
	}

	if user.HasPassword {
		t.Fatal("expected invalid legacy hash to be treated as no password")
	}

	if err := authService.UpdatePassword(context.Background(), user.ID, UpdatePasswordRequest{
		NewPassword: "NewSecret123!",
	}); err != nil {
		t.Fatalf("UpdatePassword() should allow replacing invalid legacy hash: %v", err)
	}

	loginResult, err := authService.LoginWithPassword(context.Background(), PasswordLoginRequest{
		Email:    email,
		Password: "NewSecret123!",
	})
	if err != nil {
		t.Fatalf("LoginWithPassword() unexpected error after replacing legacy hash: %v", err)
	}
	if loginResult == nil || loginResult.User == nil || !loginResult.User.HasPassword {
		t.Fatal("expected user to have a valid password after update")
	}
}
