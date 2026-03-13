package validator

import (
	"regexp"
	"strings"
)

// ============================================
// Vietnamese Phone Number Validator
// Supports all VN mobile carriers
// ============================================

var vnPhoneRegex = regexp.MustCompile(`^(0|\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])\d{7}$`)

// IsVietnamesePhone validates Vietnamese phone number format.
// Accepts formats: 0912345678, +84912345678
func IsVietnamesePhone(phone string) bool {
	cleaned := strings.TrimSpace(phone)
	if cleaned == "" {
		return false
	}
	return vnPhoneRegex.MatchString(cleaned)
}

// NormalizePhone converts +84 prefix to 0 prefix.
func NormalizePhone(phone string) string {
	phone = strings.TrimSpace(phone)
	if strings.HasPrefix(phone, "+84") {
		return "0" + phone[3:]
	}
	return phone
}

// ============================================
// Email Validator
// ============================================

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// IsValidEmail validates email format.
func IsValidEmail(email string) bool {
	return emailRegex.MatchString(strings.TrimSpace(email))
}

// ============================================
// UUID Validator
// ============================================

var uuidRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// IsValidUUID checks if a string is a valid UUID v4 format.
func IsValidUUID(s string) bool {
	return uuidRegex.MatchString(strings.TrimSpace(s))
}
