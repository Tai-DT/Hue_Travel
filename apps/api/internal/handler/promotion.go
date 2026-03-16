package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/huetravel/api/internal/repository"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Promotion Handler — Coupon / Mã giảm giá
// ============================================

type PromotionHandler struct {
	promoRepo *repository.PromotionRepository
}

func NewPromotionHandler(promoRepo *repository.PromotionRepository) *PromotionHandler {
	return &PromotionHandler{promoRepo: promoRepo}
}

// Create — tạo promotion (admin/guide)
func (h *PromotionHandler) Create(c *gin.Context) {
	var promo repository.Promotion
	if err := c.ShouldBindJSON(&promo); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Dữ liệu không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	uid := userID.(uuid.UUID)
	promo.CreatorID = &uid
	promo.IsActive = true
	if promo.StartsAt.IsZero() {
		promo.StartsAt = time.Now()
	}
	if promo.PerUserLimit <= 0 {
		promo.PerUserLimit = 1
	}
	if promo.UsageLimit <= 0 {
		promo.UsageLimit = 100
	}

	if err := h.promoRepo.Create(c.Request.Context(), &promo); err != nil {
		response.InternalError(c, "Không thể tạo khuyến mãi: "+err.Error())
		return
	}

	response.Created(c, gin.H{"promotion": promo})
}

// ListActive — danh sách khuyến mãi đang có
func (h *PromotionHandler) ListActive(c *gin.Context) {
	promos, err := h.promoRepo.ListActive(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Không thể tải khuyến mãi")
		return
	}
	if promos == nil {
		promos = []repository.Promotion{}
	}
	response.OK(c, gin.H{
		"promotions": promos,
		"total":      len(promos),
	})
}

// Apply — áp dụng mã giảm giá
func (h *PromotionHandler) Apply(c *gin.Context) {
	var req struct {
		Code        string `json:"code" binding:"required"`
		OrderAmount int64  `json:"order_amount" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "HT-VAL-001", "Thiếu mã giảm giá hoặc giá trị đơn hàng")
		return
	}

	userID, _ := c.Get("user_id")
	discount, promo, err := h.promoRepo.ApplyPromotion(c.Request.Context(), req.Code, userID.(uuid.UUID), req.OrderAmount)
	if err != nil {
		response.BadRequest(c, "HT-PROMO-001", err.Error())
		return
	}

	response.OK(c, gin.H{
		"discount":    discount,
		"final_price": req.OrderAmount - discount,
		"promotion":   promo,
	})
}

// MyCoupons — coupon khả dụng cho user hiện tại
func (h *PromotionHandler) MyCoupons(c *gin.Context) {
	userID, _ := c.Get("user_id")
	promos, err := h.promoRepo.GetUserCoupons(c.Request.Context(), userID.(uuid.UUID))
	if err != nil {
		response.InternalError(c, "Không thể tải coupon")
		return
	}
	if promos == nil {
		promos = []repository.Promotion{}
	}
	response.OK(c, gin.H{
		"coupons": promos,
		"total":   len(promos),
	})
}
