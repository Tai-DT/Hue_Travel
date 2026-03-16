package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================
// Promotion Repository
// ============================================

type Promotion struct {
	ID            uuid.UUID  `json:"id"`
	Code          string     `json:"code"`
	Title         string     `json:"title"`
	Description   *string    `json:"description"`
	DiscountType  string     `json:"discount_type"`
	DiscountValue int64      `json:"discount_value"`
	MinOrder      int64      `json:"min_order"`
	MaxDiscount   *int64     `json:"max_discount"`
	UsageLimit    int        `json:"usage_limit"`
	UsedCount     int        `json:"used_count"`
	PerUserLimit  int        `json:"per_user_limit"`
	ExperienceID  *uuid.UUID `json:"experience_id"`
	CreatorID     *uuid.UUID `json:"creator_id"`
	IsFlashSale   bool       `json:"is_flash_sale"`
	IsActive      bool       `json:"is_active"`
	StartsAt      time.Time  `json:"starts_at"`
	ExpiresAt     time.Time  `json:"expires_at"`
	CreatedAt     time.Time  `json:"created_at"`
}

type PromotionRepository struct {
	pool *pgxpool.Pool
}

func NewPromotionRepository(pool *pgxpool.Pool) *PromotionRepository {
	return &PromotionRepository{pool: pool}
}

// Create — tạo promotion mới
func (r *PromotionRepository) Create(ctx context.Context, p *Promotion) error {
	p.ID = uuid.New()
	p.CreatedAt = time.Now()
	_, err := r.pool.Exec(ctx, `
		INSERT INTO promotions (id, code, title, description, discount_type, discount_value,
			min_order, max_discount, usage_limit, per_user_limit, experience_id, creator_id,
			is_flash_sale, is_active, starts_at, expires_at, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
	`, p.ID, p.Code, p.Title, p.Description, p.DiscountType, p.DiscountValue,
		p.MinOrder, p.MaxDiscount, p.UsageLimit, p.PerUserLimit, p.ExperienceID, p.CreatorID,
		p.IsFlashSale, p.IsActive, p.StartsAt, p.ExpiresAt, p.CreatedAt)
	return err
}

// ListActive — danh sách promotion đang active
func (r *PromotionRepository) ListActive(ctx context.Context) ([]Promotion, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, code, title, description, discount_type, discount_value,
		       min_order, max_discount, usage_limit, used_count, per_user_limit,
		       experience_id, is_flash_sale, is_active, starts_at, expires_at, created_at
		FROM promotions
		WHERE is_active = TRUE AND starts_at <= NOW() AND expires_at > NOW()
		  AND used_count < usage_limit
		ORDER BY is_flash_sale DESC, expires_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanPromotions(rows)
}

// GetByCode — tìm promotion theo code
func (r *PromotionRepository) GetByCode(ctx context.Context, code string) (*Promotion, error) {
	var p Promotion
	err := r.pool.QueryRow(ctx, `
		SELECT id, code, title, description, discount_type, discount_value,
		       min_order, max_discount, usage_limit, used_count, per_user_limit,
		       experience_id, is_flash_sale, is_active, starts_at, expires_at, created_at
		FROM promotions WHERE code = $1
	`, code).Scan(
		&p.ID, &p.Code, &p.Title, &p.Description, &p.DiscountType, &p.DiscountValue,
		&p.MinOrder, &p.MaxDiscount, &p.UsageLimit, &p.UsedCount, &p.PerUserLimit,
		&p.ExperienceID, &p.IsFlashSale, &p.IsActive, &p.StartsAt, &p.ExpiresAt, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// ApplyPromotion — áp dụng mã giảm giá
func (r *PromotionRepository) ApplyPromotion(ctx context.Context, code string, userID uuid.UUID, orderAmount int64) (int64, *Promotion, error) {
	promo, err := r.GetByCode(ctx, code)
	if err != nil {
		return 0, nil, fmt.Errorf("mã giảm giá không tồn tại")
	}

	// Validate
	now := time.Now()
	if !promo.IsActive {
		return 0, nil, fmt.Errorf("mã giảm giá đã hết hiệu lực")
	}
	if now.Before(promo.StartsAt) || now.After(promo.ExpiresAt) {
		return 0, nil, fmt.Errorf("mã giảm giá chưa bắt đầu hoặc đã hết hạn")
	}
	if promo.UsedCount >= promo.UsageLimit {
		return 0, nil, fmt.Errorf("mã giảm giá đã hết lượt sử dụng")
	}
	if orderAmount < promo.MinOrder {
		return 0, nil, fmt.Errorf("đơn hàng tối thiểu %dđ", promo.MinOrder)
	}

	// Check per-user limit
	var userUsed int
	r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM promotion_usages WHERE promotion_id = $1 AND user_id = $2
	`, promo.ID, userID).Scan(&userUsed)
	if userUsed >= promo.PerUserLimit {
		return 0, nil, fmt.Errorf("bạn đã sử dụng mã này rồi")
	}

	// Calculate discount
	var discount int64
	if promo.DiscountType == "percent" {
		discount = orderAmount * promo.DiscountValue / 100
		if promo.MaxDiscount != nil && discount > *promo.MaxDiscount {
			discount = *promo.MaxDiscount
		}
	} else {
		discount = promo.DiscountValue
	}
	if discount > orderAmount {
		discount = orderAmount
	}

	// Record usage
	_, _ = r.pool.Exec(ctx, `
		INSERT INTO promotion_usages (promotion_id, user_id, discount_amount)
		VALUES ($1, $2, $3)
	`, promo.ID, userID, discount)

	// Increment used count
	_, _ = r.pool.Exec(ctx, `
		UPDATE promotions SET used_count = used_count + 1 WHERE id = $1
	`, promo.ID)

	return discount, promo, nil
}

// GetUserCoupons — coupon khả dụng cho user
func (r *PromotionRepository) GetUserCoupons(ctx context.Context, userID uuid.UUID) ([]Promotion, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT p.id, p.code, p.title, p.description, p.discount_type, p.discount_value,
		       p.min_order, p.max_discount, p.usage_limit, p.used_count, p.per_user_limit,
		       p.experience_id, p.is_flash_sale, p.is_active, p.starts_at, p.expires_at, p.created_at
		FROM promotions p
		WHERE p.is_active = TRUE AND p.starts_at <= NOW() AND p.expires_at > NOW()
		  AND p.used_count < p.usage_limit
		  AND (SELECT COUNT(*) FROM promotion_usages pu WHERE pu.promotion_id = p.id AND pu.user_id = $1) < p.per_user_limit
		ORDER BY p.expires_at ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanPromotions(rows)
}

func scanPromotions(rows interface{ Next() bool; Scan(...interface{}) error }) ([]Promotion, error) {
	var promos []Promotion
	for rows.Next() {
		var p Promotion
		if err := rows.Scan(
			&p.ID, &p.Code, &p.Title, &p.Description, &p.DiscountType, &p.DiscountValue,
			&p.MinOrder, &p.MaxDiscount, &p.UsageLimit, &p.UsedCount, &p.PerUserLimit,
			&p.ExperienceID, &p.IsFlashSale, &p.IsActive, &p.StartsAt, &p.ExpiresAt, &p.CreatedAt,
		); err != nil {
			continue
		}
		promos = append(promos, p)
	}
	return promos, nil
}
