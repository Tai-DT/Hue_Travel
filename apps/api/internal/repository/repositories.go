// Package repository provides the data access layer for the Huế Travel API.
//
// Repositories are split into separate files by domain:
//   - user.go         — UserRepository
//   - otp.go          — OTPRepository
//   - experience.go   — ExperienceRepository
//   - booking.go      — BookingRepository
//   - review_favorite_guide.go — ReviewRepository, FavoriteRepository, GuideProfileRepository
//   - chat.go         — ChatRepository
//   - helpers.go      — shared utility functions (generateSlug, etc.)
package repository
