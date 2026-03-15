package handler

import (
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/huetravel/api/internal/service"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Place Handler
// ============================================

type PlaceHandler struct {
	placesSvc *service.GooglePlacesService
}

func NewPlaceHandler(placesSvc *service.GooglePlacesService) *PlaceHandler {
	return &PlaceHandler{placesSvc: placesSvc}
}

// Huế city center coordinates
const (
	hueCenterLat = 16.4637
	hueCenterLng = 107.5909
)

func (h *PlaceHandler) Search(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		response.BadRequest(c, "HT-VAL-001", "Vui lòng nhập từ khoá tìm kiếm")
		return
	}

	places, err := h.placesSvc.TextSearch(c.Request.Context(), query, hueCenterLat, hueCenterLng)
	if err != nil {
		if errors.Is(err, service.ErrServiceNotConfigured) || errors.Is(err, service.ErrServiceUnavailable) {
			response.ServiceUnavailable(c, "HT-PLACE-001", "Dịch vụ bản đồ hiện chưa sẵn sàng")
			return
		}
		response.InternalError(c, "Không thể tìm kiếm: "+err.Error())
		return
	}

	response.OK(c, gin.H{
		"query":  query,
		"places": places,
		"total":  len(places),
	})
}

func (h *PlaceHandler) NearbyRestaurants(c *gin.Context) {
	lat := hueCenterLat
	lng := hueCenterLng
	radius := 2000

	if v := c.Query("lat"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			lat = f
		}
	}
	if v := c.Query("lng"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			lng = f
		}
	}
	if v := c.Query("radius"); v != "" {
		if r, err := strconv.Atoi(v); err == nil && r > 0 && r <= 50000 {
			radius = r
		}
	}

	placeType := c.DefaultQuery("type", "restaurant")

	places, err := h.placesSvc.NearbySearch(c.Request.Context(), lat, lng, radius, placeType)
	if err != nil {
		if errors.Is(err, service.ErrServiceNotConfigured) || errors.Is(err, service.ErrServiceUnavailable) {
			response.ServiceUnavailable(c, "HT-PLACE-002", "Dịch vụ địa điểm hiện chưa sẵn sàng")
			return
		}
		response.InternalError(c, "Không thể tải quán ăn gần đây")
		return
	}

	response.OK(c, gin.H{
		"restaurants": places,
		"total":       len(places),
		"center":      gin.H{"lat": lat, "lng": lng},
		"radius":      radius,
	})
}

func (h *PlaceHandler) GetDirections(c *gin.Context) {
	originLat, _ := strconv.ParseFloat(c.Query("origin_lat"), 64)
	originLng, _ := strconv.ParseFloat(c.Query("origin_lng"), 64)
	destLat, _ := strconv.ParseFloat(c.Query("dest_lat"), 64)
	destLng, _ := strconv.ParseFloat(c.Query("dest_lng"), 64)
	mode := c.DefaultQuery("mode", "driving")

	if originLat == 0 || destLat == 0 {
		response.BadRequest(c, "HT-VAL-001", "Thiếu toạ độ origin/destination")
		return
	}

	dir, err := h.placesSvc.GetDirections(c.Request.Context(), originLat, originLng, destLat, destLng, mode)
	if err != nil {
		if errors.Is(err, service.ErrServiceNotConfigured) || errors.Is(err, service.ErrServiceUnavailable) {
			response.ServiceUnavailable(c, "HT-PLACE-003", "Dịch vụ chỉ đường hiện chưa sẵn sàng")
			return
		}
		response.InternalError(c, "Không thể lấy đường đi")
		return
	}

	response.OK(c, gin.H{"directions": dir})
}
