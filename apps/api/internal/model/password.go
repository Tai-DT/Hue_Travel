package model

import (
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// HasUsablePasswordHash reports whether the stored hash is a valid bcrypt hash.
// Legacy seed rows contain placeholder strings that should be treated as "no password".
func HasUsablePasswordHash(passwordHash *string) bool {
	if passwordHash == nil {
		return false
	}

	hash := strings.TrimSpace(*passwordHash)
	if hash == "" {
		return false
	}

	_, err := bcrypt.Cost([]byte(hash))
	return err == nil
}
