package repository

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// generateSlug creates a URL-friendly slug from a title.
func generateSlug(title string) string {
	slug := strings.ToLower(title)
	slug = strings.ReplaceAll(slug, " ", "-")
	// Remove Vietnamese diacritics would go here in production
	slug = fmt.Sprintf("%s-%s", slug, uuid.New().String()[:8])
	return slug
}
