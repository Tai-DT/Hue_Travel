package testutil

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/huetravel/api/internal/model"
	"github.com/huetravel/api/internal/repository"
)

// ============================================
// Mock User Repository
// ============================================

type MockUserRepo struct {
	Users      map[uuid.UUID]*model.User
	PhoneIndex map[string]uuid.UUID
	EmailIndex map[string]uuid.UUID
	CreateErr  error
}

func NewMockUserRepo() *MockUserRepo {
	return &MockUserRepo{
		Users:      make(map[uuid.UUID]*model.User),
		PhoneIndex: make(map[string]uuid.UUID),
		EmailIndex: make(map[string]uuid.UUID),
	}
}

func (m *MockUserRepo) Create(_ context.Context, user *model.User) error {
	if m.CreateErr != nil {
		return m.CreateErr
	}
	user.ID = uuid.New()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	if user.Level == "" {
		user.Level = "Newbie"
	}
	m.Users[user.ID] = user
	user.HasPassword = model.HasUsablePasswordHash(user.PasswordHash)
	if user.Phone != nil {
		m.PhoneIndex[*user.Phone] = user.ID
	}
	if user.Email != nil {
		m.EmailIndex[strings.ToLower(*user.Email)] = user.ID
	}
	return nil
}

func (m *MockUserRepo) GetByID(_ context.Context, id uuid.UUID) (*model.User, error) {
	u, ok := m.Users[id]
	if !ok {
		return nil, nil
	}
	return u, nil
}

func (m *MockUserRepo) GetByEmail(_ context.Context, email string) (*model.User, error) {
	id, ok := m.EmailIndex[strings.ToLower(email)]
	if !ok {
		return nil, nil
	}
	return m.Users[id], nil
}

func (m *MockUserRepo) UpdateLastLogin(_ context.Context, userID uuid.UUID) error {
	if u, ok := m.Users[userID]; ok {
		now := time.Now()
		u.LastLoginAt = &now
	}
	return nil
}

func (m *MockUserRepo) UpdatePassword(_ context.Context, userID uuid.UUID, passwordHash string) error {
	if u, ok := m.Users[userID]; ok {
		u.PasswordHash = &passwordHash
		u.HasPassword = model.HasUsablePasswordHash(u.PasswordHash)
		return nil
	}
	return fmt.Errorf("user not found")
}

func (m *MockUserRepo) AddXP(_ context.Context, userID uuid.UUID, xp int) error {
	if u, ok := m.Users[userID]; ok {
		u.XP += xp
	}
	return nil
}

func (m *MockUserRepo) UpdateProfile(_ context.Context, userID uuid.UUID, fullName string, email, bio, avatarURL *string, languages []string) error {
	u, ok := m.Users[userID]
	if !ok {
		return fmt.Errorf("user not found")
	}
	u.FullName = fullName
	u.Email = email
	u.Bio = bio
	u.AvatarURL = avatarURL
	u.Languages = languages
	return nil
}

func (m *MockUserRepo) ListUsers(_ context.Context, _, _ string, _, _ int) ([]model.User, int64, error) {
	var users []model.User
	for _, u := range m.Users {
		users = append(users, *u)
	}
	return users, int64(len(users)), nil
}

func (m *MockUserRepo) SetActive(_ context.Context, userID uuid.UUID, active bool) error {
	if u, ok := m.Users[userID]; ok {
		u.IsActive = active
	}
	return nil
}

func (m *MockUserRepo) SetRole(_ context.Context, userID uuid.UUID, role string) error {
	if u, ok := m.Users[userID]; ok {
		u.Role = model.UserRole(role)
	}
	return nil
}

// ============================================
// Mock Experience Repository
// ============================================

type MockExperienceRepo struct {
	Experiences map[uuid.UUID]*model.Experience
}

func NewMockExperienceRepo() *MockExperienceRepo {
	return &MockExperienceRepo{
		Experiences: make(map[uuid.UUID]*model.Experience),
	}
}

func (m *MockExperienceRepo) List(_ context.Context, _ repository.ExperienceFilter) ([]model.Experience, int64, error) {
	var exps []model.Experience
	for _, exp := range m.Experiences {
		if exp.IsActive {
			exps = append(exps, *exp)
		}
	}
	return exps, int64(len(exps)), nil
}

func (m *MockExperienceRepo) GetByID(_ context.Context, id uuid.UUID) (*model.Experience, error) {
	exp, ok := m.Experiences[id]
	if !ok || !exp.IsActive {
		return nil, nil
	}
	return exp, nil
}

func (m *MockExperienceRepo) Create(_ context.Context, exp *model.Experience) error {
	exp.ID = uuid.New()
	exp.IsActive = true
	exp.CreatedAt = time.Now()
	exp.UpdatedAt = time.Now()
	m.Experiences[exp.ID] = exp
	return nil
}

func (m *MockExperienceRepo) Update(_ context.Context, exp *model.Experience) error {
	m.Experiences[exp.ID] = exp
	return nil
}

func (m *MockExperienceRepo) SoftDelete(_ context.Context, id uuid.UUID) error {
	if exp, ok := m.Experiences[id]; ok {
		exp.IsActive = false
	}
	return nil
}

func (m *MockExperienceRepo) GetOwnerID(_ context.Context, id uuid.UUID) (uuid.UUID, error) {
	exp, ok := m.Experiences[id]
	if !ok {
		return uuid.UUID{}, fmt.Errorf("not found")
	}
	return exp.GuideID, nil
}

// ============================================
// Mock Booking Repository
// ============================================

type MockBookingRepo struct {
	Bookings map[uuid.UUID]*model.Booking
}

func NewMockBookingRepo() *MockBookingRepo {
	return &MockBookingRepo{
		Bookings: make(map[uuid.UUID]*model.Booking),
	}
}

func (m *MockBookingRepo) Create(_ context.Context, booking *model.Booking) error {
	booking.ID = uuid.New()
	booking.CreatedAt = time.Now()
	booking.UpdatedAt = time.Now()
	m.Bookings[booking.ID] = booking
	return nil
}

func (m *MockBookingRepo) GetByID(_ context.Context, id uuid.UUID) (*model.Booking, error) {
	b, ok := m.Bookings[id]
	if !ok {
		return nil, nil
	}
	return b, nil
}

func (m *MockBookingRepo) ListByTraveler(_ context.Context, travelerID uuid.UUID, status string, _, _ int) ([]model.Booking, int64, error) {
	var bookings []model.Booking
	for _, b := range m.Bookings {
		if b.TravelerID == travelerID {
			if status == "" || string(b.Status) == status {
				bookings = append(bookings, *b)
			}
		}
	}
	return bookings, int64(len(bookings)), nil
}

func (m *MockBookingRepo) ListByGuide(_ context.Context, guideID uuid.UUID, status string, _, _ int) ([]model.Booking, int64, error) {
	var bookings []model.Booking
	for _, b := range m.Bookings {
		if b.GuideID == guideID {
			if status == "" || string(b.Status) == status {
				bookings = append(bookings, *b)
			}
		}
	}
	return bookings, int64(len(bookings)), nil
}

func (m *MockBookingRepo) ListAll(_ context.Context, _ string, _, _ int, _ *time.Time) ([]model.Booking, int64, error) {
	var bookings []model.Booking
	for _, b := range m.Bookings {
		bookings = append(bookings, *b)
	}
	return bookings, int64(len(bookings)), nil
}

func (m *MockBookingRepo) UpdateStatus(_ context.Context, id uuid.UUID, status model.BookingStatus) error {
	if b, ok := m.Bookings[id]; ok {
		b.Status = status
		return nil
	}
	return fmt.Errorf("booking not found")
}

func (m *MockBookingRepo) SetPayment(_ context.Context, id uuid.UUID, method, ref string) error {
	if b, ok := m.Bookings[id]; ok {
		b.PaymentMethod = &method
		b.PaymentRef = &ref
		return nil
	}
	return fmt.Errorf("booking not found")
}

func (m *MockBookingRepo) UpdatePaymentRef(_ context.Context, id uuid.UUID, ref string) error {
	if b, ok := m.Bookings[id]; ok {
		b.PaymentRef = &ref
		return nil
	}
	return fmt.Errorf("booking not found")
}

func (m *MockBookingRepo) GetByPaymentRef(_ context.Context, ref string) (*model.Booking, error) {
	for _, b := range m.Bookings {
		if b.PaymentRef != nil && *b.PaymentRef == ref {
			return b, nil
		}
	}
	return nil, nil
}

func (m *MockBookingRepo) UpdatePaymentInfo(_ context.Context, id uuid.UUID, transactionNo string, paidAt *time.Time) error {
	if b, ok := m.Bookings[id]; ok {
		b.PaymentRef = &transactionNo
		b.PaidAt = paidAt
		return nil
	}
	return fmt.Errorf("booking not found")
}

// ============================================
// Compile-time interface checks
// ============================================

var _ repository.UserRepo = (*MockUserRepo)(nil)
var _ repository.ExperienceRepo = (*MockExperienceRepo)(nil)
var _ repository.BookingRepo = (*MockBookingRepo)(nil)

// ============================================
// Test Helper — seed data
// ============================================

func SeedTestExperience(repo *MockExperienceRepo, guideID uuid.UUID) *model.Experience {
	exp := &model.Experience{
		ID:           uuid.New(),
		GuideID:      guideID,
		Title:        "Tour Đại Nội Huế",
		Description:  "Khám phá kinh thành Huế",
		Category:     model.CatSight,
		Price:        500000,
		MaxGuests:    10,
		DurationMins: 120,
		MeetingPoint: "Cổng Ngọ Môn",
		MeetingLat:   16.4698,
		MeetingLng:   107.5784,
		IsActive:     true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	repo.Experiences[exp.ID] = exp
	return exp
}

func SeedTestUser(repo *MockUserRepo, role model.UserRole) *model.User {
	phone := fmt.Sprintf("090%07d", len(repo.Users))
	user := &model.User{
		ID:       uuid.New(),
		Phone:    &phone,
		FullName: "Test User " + phone,
		Role:     role,
		IsActive: true,
		Level:    "Newbie",
	}
	repo.Users[user.ID] = user
	repo.PhoneIndex[phone] = user.ID
	return user
}
