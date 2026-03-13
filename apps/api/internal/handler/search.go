package handler

import (
	"errors"

	"github.com/gin-gonic/gin"

	"github.com/huetravel/api/internal/service"
	"github.com/huetravel/api/pkg/response"
)

// ============================================
// Search Handler
// ============================================

type SearchHandler struct {
	searchService *service.SearchService
}

func NewSearchHandler(searchService *service.SearchService) *SearchHandler {
	return &SearchHandler{searchService: searchService}
}

// Search — tìm kiếm full-text
func (h *SearchHandler) Search(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		response.BadRequest(c, "HT-VAL-001", "Query không được để trống")
		return
	}

	filters := service.SearchFilters{
		Type:     c.Query("type"),
		Category: c.Query("category"),
		Location: c.Query("location"),
	}

	// Parse limit/offset
	if limit := c.Query("limit"); limit != "" {
		var l int
		if _, err := parseSafe(limit, &l); err == nil {
			filters.Limit = l
		}
	}

	result, err := h.searchService.Search(c.Request.Context(), query, filters)
	if err != nil {
		if errors.Is(err, service.ErrServiceNotConfigured) || errors.Is(err, service.ErrServiceUnavailable) {
			response.ServiceUnavailable(c, "HT-SEARCH-001", "Search hiện chưa sẵn sàng")
			return
		}
		response.InternalError(c, "Không thể tìm kiếm")
		return
	}
	response.OK(c, result)
}

// Suggest — gợi ý auto-complete
func (h *SearchHandler) Suggest(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		response.OK(c, []string{})
		return
	}
	if !h.searchService.IsReady() {
		response.ServiceUnavailable(c, "HT-SEARCH-002", "Search suggest hiện chưa sẵn sàng")
		return
	}

	suggestions := h.searchService.Suggest(c.Request.Context(), query, 8)
	response.OK(c, gin.H{
		"suggestions": suggestions,
		"query":       query,
	})
}

// Trending — tìm kiếm phổ biến
func (h *SearchHandler) Trending(c *gin.Context) {
	if !h.searchService.IsReady() {
		response.ServiceUnavailable(c, "HT-SEARCH-003", "Search trending hiện chưa sẵn sàng")
		return
	}
	trending := h.searchService.Trending()
	response.OK(c, gin.H{
		"trending": trending,
	})
}

// Stats — search index stats
func (h *SearchHandler) IndexStats(c *gin.Context) {
	if !h.searchService.IsReady() {
		response.ServiceUnavailable(c, "HT-SEARCH-004", "Search index hiện chưa sẵn sàng")
		return
	}
	stats := h.searchService.GetStats()
	response.OK(c, gin.H{
		"index_stats": stats,
	})
}

func parseSafe(s string, v *int) (bool, error) {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return false, nil
		}
		n = n*10 + int(c-'0')
	}
	*v = n
	return true, nil
}
