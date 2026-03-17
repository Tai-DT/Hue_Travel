package model

import (
	"time"

	"github.com/google/uuid"
)

// ============================================
// Blog Models
// ============================================

type BlogPost struct {
	ID           uuid.UUID  `json:"id"`
	AuthorID     uuid.UUID  `json:"author_id"`
	AuthorName   string     `json:"author_name,omitempty"`
	AuthorAvatar *string    `json:"author_avatar,omitempty"`
	Slug         string     `json:"slug"`
	Title        string     `json:"title"`
	Excerpt      *string    `json:"excerpt"`
	Content      string     `json:"content"`
	CoverImage   *string    `json:"cover_image"`
	Tags         []string   `json:"tags"`
	Category     string     `json:"category"`
	ViewCount    int        `json:"view_count"`
	LikeCount    int        `json:"like_count"`
	IsFeatured   bool       `json:"is_featured"`
	IsPublished  bool       `json:"is_published"`
	PublishedAt  *time.Time `json:"published_at"`
	CreatedAt    time.Time  `json:"created_at"`
}

type BlogComment struct {
	ID        uuid.UUID `json:"id"`
	BlogID    uuid.UUID `json:"blog_id"`
	UserID    uuid.UUID `json:"user_id"`
	UserName  string    `json:"user_name"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

// ============================================
// Diary Models
// ============================================

type DiaryEntry struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	Title        string    `json:"title"`
	Content      string    `json:"content"`
	Mood         string    `json:"mood"`
	LocationName *string   `json:"location_name"`
	Lat          *float64  `json:"lat"`
	Lng          *float64  `json:"lng"`
	PhotoURLs    []string  `json:"photo_urls"`
	IsPublic     bool      `json:"is_public"`
	Weather      *string   `json:"weather"`
	CreatedAt    time.Time `json:"created_at"`
}

// ============================================
// Story (Travel Feed) Models
// ============================================

type Story struct {
	ID           uuid.UUID  `json:"id"`
	AuthorID     uuid.UUID  `json:"author_id"`
	AuthorName   string     `json:"author_name,omitempty"`
	AuthorAvatar *string    `json:"author_avatar,omitempty"`
	Content      *string    `json:"content"`
	MediaURLs    []string   `json:"media_urls"`
	MediaType    string     `json:"media_type"`
	LocationName *string    `json:"location_name"`
	Lat          *float64   `json:"lat,omitempty"`
	Lng          *float64   `json:"lng,omitempty"`
	ExperienceID *uuid.UUID `json:"experience_id,omitempty"`
	LikeCount    int        `json:"like_count"`
	CommentCount int        `json:"comment_count"`
	IsLiked      bool       `json:"is_liked"`
	CreatedAt    time.Time  `json:"created_at"`
}

type StoryComment struct {
	ID         uuid.UUID `json:"id"`
	StoryID    uuid.UUID `json:"story_id"`
	UserID     uuid.UUID `json:"user_id"`
	UserName   string    `json:"user_name,omitempty"`
	UserAvatar *string   `json:"user_avatar,omitempty"`
	Content    string    `json:"content"`
	CreatedAt  time.Time `json:"created_at"`
}

// ============================================
// Collection (Bookmarks) Models
// ============================================

type Collection struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	CoverImage  *string   `json:"cover_image"`
	IsPublic    bool      `json:"is_public"`
	ItemCount   int       `json:"item_count"`
	CreatedAt   time.Time `json:"created_at"`
}

type CollectionItem struct {
	ID           uuid.UUID `json:"id"`
	CollectionID uuid.UUID `json:"collection_id"`
	ItemType     string    `json:"item_type"`
	ItemID       uuid.UUID `json:"item_id"`
	Note         *string   `json:"note"`
	AddedAt      time.Time `json:"added_at"`
}
