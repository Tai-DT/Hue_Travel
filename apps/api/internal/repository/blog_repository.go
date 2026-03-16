package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================
// Blog Repository
// ============================================

type BlogPost struct {
	ID          uuid.UUID  `json:"id"`
	AuthorID    uuid.UUID  `json:"author_id"`
	AuthorName  string     `json:"author_name,omitempty"`
	AuthorAvatar *string   `json:"author_avatar,omitempty"`
	Slug        string     `json:"slug"`
	Title       string     `json:"title"`
	Excerpt     *string    `json:"excerpt"`
	Content     string     `json:"content"`
	CoverImage  *string    `json:"cover_image"`
	Tags        []string   `json:"tags"`
	Category    string     `json:"category"`
	ViewCount   int        `json:"view_count"`
	LikeCount   int        `json:"like_count"`
	IsFeatured  bool       `json:"is_featured"`
	IsPublished bool       `json:"is_published"`
	PublishedAt *time.Time `json:"published_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

type BlogComment struct {
	ID        uuid.UUID `json:"id"`
	BlogID    uuid.UUID `json:"blog_id"`
	UserID    uuid.UUID `json:"user_id"`
	UserName  string    `json:"user_name"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type BlogRepository struct {
	pool *pgxpool.Pool
}

func NewBlogRepository(pool *pgxpool.Pool) *BlogRepository {
	return &BlogRepository{pool: pool}
}

func (r *BlogRepository) Create(ctx context.Context, post *BlogPost) error {
	post.ID = uuid.New()
	now := time.Now()
	post.CreatedAt = now
	if post.IsPublished {
		post.PublishedAt = &now
	}
	if post.Slug == "" {
		post.Slug = strings.ReplaceAll(strings.ToLower(post.Title), " ", "-") + "-" + post.ID.String()[:8]
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO blog_posts (id, author_id, slug, title, excerpt, content, cover_image, tags, category, is_published, published_at, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		post.ID, post.AuthorID, post.Slug, post.Title, post.Excerpt, post.Content,
		post.CoverImage, post.Tags, post.Category, post.IsPublished, post.PublishedAt, post.CreatedAt)
	return err
}

func (r *BlogRepository) ListPublished(ctx context.Context, category string, page, perPage int) ([]BlogPost, int64, error) {
	if page < 1 { page = 1 }
	if perPage < 1 || perPage > 50 { perPage = 10 }

	where := "is_published = TRUE"
	args := []interface{}{}
	argIdx := 1
	if category != "" {
		where += " AND category = $1"
		args = append(args, category)
		argIdx = 2
	}

	var total int64
	r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM blog_posts WHERE "+where, args...).Scan(&total)

	offset := (page - 1) * perPage
	args = append(args, perPage, offset)

	rows, err := r.pool.Query(ctx, `
		SELECT b.id, b.author_id, u.full_name, u.avatar_url, b.slug, b.title, b.excerpt,
		       b.cover_image, b.tags, b.category, b.view_count, b.like_count,
		       b.is_featured, b.published_at, b.created_at
		FROM blog_posts b JOIN users u ON u.id = b.author_id
		WHERE `+where+`
		ORDER BY b.is_featured DESC, b.published_at DESC
		LIMIT $`+itoa(argIdx)+` OFFSET $`+itoa(argIdx+1), args...)
	if err != nil { return nil, 0, err }
	defer rows.Close()

	var posts []BlogPost
	for rows.Next() {
		var p BlogPost
		rows.Scan(&p.ID, &p.AuthorID, &p.AuthorName, &p.AuthorAvatar, &p.Slug, &p.Title, &p.Excerpt,
			&p.CoverImage, &p.Tags, &p.Category, &p.ViewCount, &p.LikeCount,
			&p.IsFeatured, &p.PublishedAt, &p.CreatedAt)
		posts = append(posts, p)
	}
	return posts, total, nil
}

func (r *BlogRepository) GetBySlug(ctx context.Context, slug string) (*BlogPost, error) {
	var p BlogPost
	err := r.pool.QueryRow(ctx, `
		SELECT b.id, b.author_id, u.full_name, u.avatar_url, b.slug, b.title, b.excerpt, b.content,
		       b.cover_image, b.tags, b.category, b.view_count, b.like_count,
		       b.is_featured, b.is_published, b.published_at, b.created_at
		FROM blog_posts b JOIN users u ON u.id = b.author_id WHERE b.slug = $1`, slug,
	).Scan(&p.ID, &p.AuthorID, &p.AuthorName, &p.AuthorAvatar, &p.Slug, &p.Title, &p.Excerpt, &p.Content,
		&p.CoverImage, &p.Tags, &p.Category, &p.ViewCount, &p.LikeCount,
		&p.IsFeatured, &p.IsPublished, &p.PublishedAt, &p.CreatedAt)
	if err != nil { return nil, err }
	// Increment views
	r.pool.Exec(ctx, `UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1`, p.ID)
	p.ViewCount++
	return &p, nil
}

func (r *BlogRepository) ToggleLike(ctx context.Context, blogID, userID uuid.UUID) (bool, error) {
	var exists bool
	r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM blog_likes WHERE blog_id=$1 AND user_id=$2)`, blogID, userID).Scan(&exists)
	if exists {
		r.pool.Exec(ctx, `DELETE FROM blog_likes WHERE blog_id=$1 AND user_id=$2`, blogID, userID)
		r.pool.Exec(ctx, `UPDATE blog_posts SET like_count = like_count - 1 WHERE id = $1`, blogID)
		return false, nil
	}
	r.pool.Exec(ctx, `INSERT INTO blog_likes (blog_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, blogID, userID)
	r.pool.Exec(ctx, `UPDATE blog_posts SET like_count = like_count + 1 WHERE id = $1`, blogID)
	return true, nil
}

func (r *BlogRepository) AddComment(ctx context.Context, blogID, userID uuid.UUID, content string) (*BlogComment, error) {
	c := &BlogComment{ID: uuid.New(), BlogID: blogID, UserID: userID, Content: content, CreatedAt: time.Now()}
	_, err := r.pool.Exec(ctx, `INSERT INTO blog_comments (id, blog_id, user_id, content, created_at) VALUES ($1,$2,$3,$4,$5)`,
		c.ID, c.BlogID, c.UserID, c.Content, c.CreatedAt)
	if err != nil { return nil, err }
	r.pool.QueryRow(ctx, `SELECT full_name FROM users WHERE id=$1`, userID).Scan(&c.UserName)
	return c, nil
}

func (r *BlogRepository) ListComments(ctx context.Context, blogID uuid.UUID) ([]BlogComment, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.blog_id, c.user_id, u.full_name, c.content, c.created_at
		FROM blog_comments c JOIN users u ON u.id = c.user_id
		WHERE c.blog_id = $1 ORDER BY c.created_at ASC`, blogID)
	if err != nil { return nil, err }
	defer rows.Close()
	var comments []BlogComment
	for rows.Next() {
		var c BlogComment
		rows.Scan(&c.ID, &c.BlogID, &c.UserID, &c.UserName, &c.Content, &c.CreatedAt)
		comments = append(comments, c)
	}
	return comments, nil
}

func (r *BlogRepository) GetTrending(ctx context.Context, limit int) ([]BlogPost, error) {
	if limit <= 0 || limit > 20 { limit = 10 }
	rows, err := r.pool.Query(ctx, `
		SELECT b.id, b.author_id, u.full_name, u.avatar_url, b.slug, b.title, b.excerpt,
		       b.cover_image, b.tags, b.category, b.view_count, b.like_count,
		       b.is_featured, b.published_at, b.created_at
		FROM blog_posts b JOIN users u ON u.id = b.author_id
		WHERE b.is_published = TRUE
		ORDER BY b.view_count DESC, b.like_count DESC LIMIT $1`, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var posts []BlogPost
	for rows.Next() {
		var p BlogPost
		rows.Scan(&p.ID, &p.AuthorID, &p.AuthorName, &p.AuthorAvatar, &p.Slug, &p.Title, &p.Excerpt,
			&p.CoverImage, &p.Tags, &p.Category, &p.ViewCount, &p.LikeCount,
			&p.IsFeatured, &p.PublishedAt, &p.CreatedAt)
		posts = append(posts, p)
	}
	return posts, nil
}

func itoa(n int) string {
	return fmt.Sprintf("%d", n)
}
