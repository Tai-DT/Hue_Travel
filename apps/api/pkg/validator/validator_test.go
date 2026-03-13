package validator

import "testing"

func TestIsVietnamesePhone(t *testing.T) {
	tests := []struct {
		name  string
		phone string
		want  bool
	}{
		// Valid numbers
		{"Viettel 032", "0321234567", true},
		{"Viettel 098", "0981234567", true},
		{"Mobifone 070", "0701234567", true},
		{"Vinaphone 088", "0881234567", true},
		{"Vietnamobile 056", "0561234567", true},
		{"+84 prefix", "+84901234567", true},
		{"+84 with 03x", "+84321234567", true},

		// Invalid numbers
		{"too short", "012345678", false},
		{"too long", "09012345678", false},
		{"invalid prefix", "0001234567", false},
		{"not a number", "abcdefghij", false},
		{"empty", "", false},
		{"landline", "02431234567", false},
		{"wrong mobile prefix", "0421234567", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsVietnamesePhone(tt.phone)
			if got != tt.want {
				t.Errorf("IsVietnamesePhone(%q) = %v, want %v", tt.phone, got, tt.want)
			}
		})
	}
}

func TestNormalizePhone(t *testing.T) {
	tests := []struct {
		input, want string
	}{
		{"+84901234567", "0901234567"},
		{"0901234567", "0901234567"},
		{" +84321234567 ", "0321234567"},
	}

	for _, tt := range tests {
		got := NormalizePhone(tt.input)
		if got != tt.want {
			t.Errorf("NormalizePhone(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestIsValidEmail(t *testing.T) {
	tests := []struct {
		email string
		want  bool
	}{
		{"user@example.com", true},
		{"user.name@domain.vn", true},
		{"a@b.co", true},
		{"", false},
		{"not-email", false},
		{"@missing.com", false},
		{"user@", false},
	}

	for _, tt := range tests {
		t.Run(tt.email, func(t *testing.T) {
			got := IsValidEmail(tt.email)
			if got != tt.want {
				t.Errorf("IsValidEmail(%q) = %v, want %v", tt.email, got, tt.want)
			}
		})
	}
}

func TestIsValidUUID(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{"550e8400-e29b-41d4-a716-446655440000", true},
		{"not-a-uuid", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := IsValidUUID(tt.input)
			if got != tt.want {
				t.Errorf("IsValidUUID(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}
