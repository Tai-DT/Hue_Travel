package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/huetravel/api/internal/model"
	"github.com/huetravel/api/internal/service"
	"github.com/huetravel/api/internal/testutil"
)

// ============================================
// BookingService Tests — using mock repos
// ============================================

func setupBookingTest() (*service.BookingService, *testutil.MockUserRepo, *testutil.MockExperienceRepo, *testutil.MockBookingRepo, *model.User, *model.Experience) {
	userRepo := testutil.NewMockUserRepo()
	expRepo := testutil.NewMockExperienceRepo()
	bookingRepo := testutil.NewMockBookingRepo()

	guide := testutil.SeedTestUser(userRepo, model.RoleGuide)
	traveler := testutil.SeedTestUser(userRepo, model.RoleTraveler)
	exp := testutil.SeedTestExperience(expRepo, guide.ID)

	svc := service.NewBookingService(bookingRepo, expRepo, userRepo, nil) // no Redis

	return svc, userRepo, expRepo, bookingRepo, traveler, exp
}

func TestBookingService_CreateBooking_Success(t *testing.T) {
	svc, _, _, bookingRepo, traveler, exp := setupBookingTest()

	futureDate := time.Now().Add(24 * time.Hour).Format("2006-01-02")
	req := service.CreateBookingRequest{
		ExperienceID: exp.ID.String(),
		BookingDate:  futureDate,
		StartTime:    "09:00",
		GuestCount:   2,
		SpecialNotes: "Cần hướng dẫn tiếng Anh",
	}

	result, err := svc.CreateBooking(context.Background(), traveler.ID, req)
	if err != nil {
		t.Fatalf("CreateBooking() unexpected error: %v", err)
	}
	if result == nil || result.Booking == nil {
		t.Fatal("expected non-nil booking result")
	}
	if result.Booking.TravelerID != traveler.ID {
		t.Errorf("expected travelerID=%s, got %s", traveler.ID, result.Booking.TravelerID)
	}
	if result.Booking.GuideID != exp.GuideID {
		t.Errorf("expected guideID=%s, got %s", exp.GuideID, result.Booking.GuideID)
	}
	if result.Booking.GuestCount != 2 {
		t.Errorf("expected guestCount=2, got %d", result.Booking.GuestCount)
	}
	// Check pricing: 500000 * 2 guests + 5% service fee
	expectedPrice := int64(500000*2) + int64(500000*2*5/100)
	if result.Booking.TotalPrice != expectedPrice {
		t.Errorf("expected totalPrice=%d, got %d", expectedPrice, result.Booking.TotalPrice)
	}
	if result.Booking.Status != model.BookingPending {
		t.Errorf("expected status=pending, got %s", result.Booking.Status)
	}

	// Verify booking was persisted in mock repo
	if len(bookingRepo.Bookings) != 1 {
		t.Errorf("expected 1 booking in repo, got %d", len(bookingRepo.Bookings))
	}
}

func TestBookingService_CreateBooking_InvalidExperienceID(t *testing.T) {
	svc, _, _, _, traveler, _ := setupBookingTest()

	req := service.CreateBookingRequest{
		ExperienceID: "not-a-uuid",
		BookingDate:  "2026-04-01",
		StartTime:    "09:00",
		GuestCount:   1,
	}

	_, err := svc.CreateBooking(context.Background(), traveler.ID, req)
	if err == nil {
		t.Error("expected error for invalid experience ID")
	}
}

func TestBookingService_CreateBooking_ExperienceNotFound(t *testing.T) {
	svc, _, _, _, traveler, _ := setupBookingTest()

	req := service.CreateBookingRequest{
		ExperienceID: uuid.New().String(),
		BookingDate:  "2026-04-01",
		StartTime:    "09:00",
		GuestCount:   1,
	}

	_, err := svc.CreateBooking(context.Background(), traveler.ID, req)
	if err == nil {
		t.Error("expected error for non-existent experience")
	}
}

func TestBookingService_CreateBooking_ExceedMaxGuests(t *testing.T) {
	svc, _, _, _, traveler, exp := setupBookingTest()

	futureDate := time.Now().Add(48 * time.Hour).Format("2006-01-02")
	req := service.CreateBookingRequest{
		ExperienceID: exp.ID.String(),
		BookingDate:  futureDate,
		StartTime:    "09:00",
		GuestCount:   99, // Max is 10
	}

	_, err := svc.CreateBooking(context.Background(), traveler.ID, req)
	if err == nil {
		t.Error("expected error for exceeding max guests")
	}
}

func TestBookingService_CreateBooking_PastDate(t *testing.T) {
	svc, _, _, _, traveler, exp := setupBookingTest()

	req := service.CreateBookingRequest{
		ExperienceID: exp.ID.String(),
		BookingDate:  "2020-01-01",
		StartTime:    "09:00",
		GuestCount:   1,
	}

	_, err := svc.CreateBooking(context.Background(), traveler.ID, req)
	if err == nil {
		t.Error("expected error for past date")
	}
}

func TestBookingService_CreateBooking_InvalidDateFormat(t *testing.T) {
	svc, _, _, _, traveler, exp := setupBookingTest()

	req := service.CreateBookingRequest{
		ExperienceID: exp.ID.String(),
		BookingDate:  "01/04/2026", // wrong format
		StartTime:    "09:00",
		GuestCount:   1,
	}

	_, err := svc.CreateBooking(context.Background(), traveler.ID, req)
	if err == nil {
		t.Error("expected error for invalid date format")
	}
}

func TestBookingService_CancelBooking_ByTraveler(t *testing.T) {
	svc, _, _, bookingRepo, traveler, exp := setupBookingTest()

	// Create a booking first
	booking := &model.Booking{
		TravelerID:   traveler.ID,
		ExperienceID: exp.ID,
		GuideID:      exp.GuideID,
		Status:       model.BookingPending,
	}
	_ = bookingRepo.Create(context.Background(), booking)

	err := svc.CancelBooking(context.Background(), booking.ID, traveler.ID, "Có việc bận")
	if err != nil {
		t.Fatalf("CancelBooking() unexpected error: %v", err)
	}

	// Check status was updated
	updated, _ := bookingRepo.GetByID(context.Background(), booking.ID)
	if updated.Status != model.BookingCancelled {
		t.Errorf("expected status=cancelled, got %s", updated.Status)
	}
}

func TestBookingService_CancelBooking_ByGuide(t *testing.T) {
	svc, _, _, bookingRepo, traveler, exp := setupBookingTest()

	booking := &model.Booking{
		TravelerID:   traveler.ID,
		ExperienceID: exp.ID,
		GuideID:      exp.GuideID,
		Status:       model.BookingConfirmed,
	}
	_ = bookingRepo.Create(context.Background(), booking)

	// Guide cancels
	err := svc.CancelBooking(context.Background(), booking.ID, exp.GuideID, "Thời tiết xấu")
	if err != nil {
		t.Fatalf("CancelBooking(byGuide) unexpected error: %v", err)
	}
}

func TestBookingService_CancelBooking_NotOwner(t *testing.T) {
	svc, _, _, bookingRepo, traveler, exp := setupBookingTest()

	booking := &model.Booking{
		TravelerID:   traveler.ID,
		ExperienceID: exp.ID,
		GuideID:      exp.GuideID,
		Status:       model.BookingPending,
	}
	_ = bookingRepo.Create(context.Background(), booking)

	randomUser := uuid.New()
	err := svc.CancelBooking(context.Background(), booking.ID, randomUser, "hack")
	if err == nil {
		t.Error("expected error for unauthorized cancellation")
	}
}

func TestBookingService_CancelBooking_CompletedBooking(t *testing.T) {
	svc, _, _, bookingRepo, traveler, exp := setupBookingTest()

	booking := &model.Booking{
		TravelerID:   traveler.ID,
		ExperienceID: exp.ID,
		GuideID:      exp.GuideID,
		Status:       model.BookingCompleted,
	}
	_ = bookingRepo.Create(context.Background(), booking)

	err := svc.CancelBooking(context.Background(), booking.ID, traveler.ID, "Muốn hủy")
	if err == nil {
		t.Error("expected error for cancelling completed booking")
	}
}

func TestBookingService_CancelBooking_NotFound(t *testing.T) {
	svc, _, _, _, traveler, _ := setupBookingTest()

	err := svc.CancelBooking(context.Background(), uuid.New(), traveler.ID, "")
	if err == nil {
		t.Error("expected error for non-existent booking")
	}
}
