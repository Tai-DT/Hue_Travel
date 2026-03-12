package service

import (
	"context"
	"log"
	"strings"
	"time"
)

// ============================================
// Search Service — Full-text Search
// Supports Meilisearch or fallback to in-memory
// ============================================

type SearchService struct {
	meilisearchURL string
	masterKey      string
	indexed        map[string][]SearchDocument
}

type SearchDocument struct {
	ID          string            `json:"id"`
	Type        string            `json:"type"` // experience, place, guide, blog
	Title       string            `json:"title"`
	Description string            `json:"description"`
	Category    string            `json:"category"`
	Tags        []string          `json:"tags"`
	ImageURL    string            `json:"image_url"`
	Rating      float64           `json:"rating"`
	Price       int64             `json:"price"`
	Location    string            `json:"location"`
	Metadata    map[string]string `json:"metadata"`
	CreatedAt   time.Time         `json:"created_at"`
}

type SearchResult struct {
	Documents  []SearchDocument `json:"documents"`
	TotalCount int              `json:"total_count"`
	Query      string           `json:"query"`
	TimeMs     int64            `json:"time_ms"`
	Facets     map[string][]Facet `json:"facets,omitempty"`
}

type Facet struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

type SearchFilters struct {
	Type     string   `json:"type,omitempty"`
	Category string   `json:"category,omitempty"`
	MinPrice int64    `json:"min_price,omitempty"`
	MaxPrice int64    `json:"max_price,omitempty"`
	MinRating float64 `json:"min_rating,omitempty"`
	Tags     []string `json:"tags,omitempty"`
	Location string   `json:"location,omitempty"`
	Limit    int      `json:"limit,omitempty"`
	Offset   int      `json:"offset,omitempty"`
}

func NewSearchService(meilisearchURL, masterKey string) *SearchService {
	s := &SearchService{
		meilisearchURL: meilisearchURL,
		masterKey:      masterKey,
		indexed:        make(map[string][]SearchDocument),
	}
	s.seedMockData()
	return s
}

func (s *SearchService) IsConfigured() bool {
	return s.meilisearchURL != ""
}

// ============================================
// Search
// ============================================

func (s *SearchService) Search(ctx context.Context, query string, filters SearchFilters) SearchResult {
	start := time.Now()

	if s.IsConfigured() {
		// In production: call Meilisearch API
		log.Printf("🔍 [Meilisearch] Search: %s", query)
	}

	// Fallback: in-memory search
	var results []SearchDocument
	queryLower := strings.ToLower(query)

	for _, docs := range s.indexed {
		for _, doc := range docs {
			if s.matchesQuery(doc, queryLower) && s.matchesFilters(doc, filters) {
				results = append(results, doc)
			}
		}
	}

	// Apply limit/offset
	limit := filters.Limit
	if limit == 0 { limit = 20 }
	offset := filters.Offset

	total := len(results)
	if offset < len(results) {
		end := offset + limit
		if end > len(results) { end = len(results) }
		results = results[offset:end]
	} else {
		results = nil
	}

	// Build facets
	facets := s.buildFacets(query, queryLower)

	return SearchResult{
		Documents:  results,
		TotalCount: total,
		Query:      query,
		TimeMs:     time.Since(start).Milliseconds(),
		Facets:     facets,
	}
}

func (s *SearchService) matchesQuery(doc SearchDocument, query string) bool {
	if query == "" { return true }
	title := strings.ToLower(doc.Title)
	desc := strings.ToLower(doc.Description)
	cat := strings.ToLower(doc.Category)
	loc := strings.ToLower(doc.Location)

	return strings.Contains(title, query) ||
		strings.Contains(desc, query) ||
		strings.Contains(cat, query) ||
		strings.Contains(loc, query) ||
		s.matchesTags(doc.Tags, query)
}

func (s *SearchService) matchesTags(tags []string, query string) bool {
	for _, t := range tags {
		if strings.Contains(strings.ToLower(t), query) { return true }
	}
	return false
}

func (s *SearchService) matchesFilters(doc SearchDocument, f SearchFilters) bool {
	if f.Type != "" && doc.Type != f.Type { return false }
	if f.Category != "" && !strings.EqualFold(doc.Category, f.Category) { return false }
	if f.MinPrice > 0 && doc.Price < f.MinPrice { return false }
	if f.MaxPrice > 0 && doc.Price > f.MaxPrice { return false }
	if f.MinRating > 0 && doc.Rating < f.MinRating { return false }
	if f.Location != "" && !strings.Contains(strings.ToLower(doc.Location), strings.ToLower(f.Location)) { return false }
	return true
}

func (s *SearchService) buildFacets(query, queryLower string) map[string][]Facet {
	categories := make(map[string]int)
	types := make(map[string]int)

	for _, docs := range s.indexed {
		for _, doc := range docs {
			if s.matchesQuery(doc, queryLower) {
				categories[doc.Category]++
				types[doc.Type]++
			}
		}
	}

	facets := map[string][]Facet{}
	for k, v := range categories {
		facets["category"] = append(facets["category"], Facet{Value: k, Count: v})
	}
	for k, v := range types {
		facets["type"] = append(facets["type"], Facet{Value: k, Count: v})
	}
	return facets
}

// ============================================
// Suggest — auto-complete
// ============================================

func (s *SearchService) Suggest(ctx context.Context, query string, limit int) []string {
	if limit == 0 { limit = 5 }
	queryLower := strings.ToLower(query)
	suggestions := make(map[string]bool)

	for _, docs := range s.indexed {
		for _, doc := range docs {
			if strings.Contains(strings.ToLower(doc.Title), queryLower) {
				suggestions[doc.Title] = true
			}
			for _, tag := range doc.Tags {
				if strings.Contains(strings.ToLower(tag), queryLower) {
					suggestions[tag] = true
				}
			}
		}
	}

	var result []string
	for s := range suggestions {
		if len(result) >= limit { break }
		result = append(result, s)
	}
	return result
}

// ============================================
// Trending — popular searches
// ============================================

func (s *SearchService) Trending() []string {
	return []string{
		"Đại Nội Huế",
		"Tour ẩm thực",
		"Sông Hương",
		"Chùa Thiên Mụ",
		"Lăng Khải Định",
		"Bún bò Huế",
		"Workshop nón Huế",
		"Cầu Trường Tiền",
	}
}

// ============================================
// Index management
// ============================================

func (s *SearchService) IndexDocument(docType string, doc SearchDocument) {
	doc.Type = docType
	doc.CreatedAt = time.Now()
	s.indexed[docType] = append(s.indexed[docType], doc)
}

func (s *SearchService) GetStats() map[string]int {
	stats := make(map[string]int)
	total := 0
	for k, v := range s.indexed {
		stats[k] = len(v)
		total += len(v)
	}
	stats["total"] = total
	return stats
}

// ============================================
// Seed mock data
// ============================================

func (s *SearchService) seedMockData() {
	experiences := []SearchDocument{
		{ID: "exp1", Title: "Khám phá Đại Nội Huế", Description: "Tour tham quan quần thể di tích cổ, tìm hiểu lịch sử triều Nguyễn", Category: "Di sản", Tags: []string{"di sản", "lịch sử", "kiến trúc"}, Rating: 4.9, Price: 250000, Location: "Huế"},
		{ID: "exp2", Title: "Tour Ẩm thực đường phố Huế", Description: "Thưởng thức bún bò, cơm hến, bánh bèo và hơn 10 món ngon", Category: "Ẩm thực", Tags: []string{"ẩm thực", "đường phố", "bún bò"}, Rating: 4.8, Price: 450000, Location: "Huế"},
		{ID: "exp3", Title: "Chèo thuyền sông Hương", Description: "Chèo SUP hoặc kayak trên sông Hương xanh mát, ngắm hoàng hôn", Category: "Thiên nhiên", Tags: []string{"sông Hương", "SUP", "hoàng hôn"}, Rating: 4.7, Price: 350000, Location: "Huế"},
		{ID: "exp4", Title: "Lăng Tự Đức & Khải Định", Description: "Tham quan hai lăng tẩm đẹp nhất triều Nguyễn", Category: "Di sản", Tags: []string{"lăng tẩm", "kiến trúc", "lịch sử"}, Rating: 4.6, Price: 500000, Location: "Huế"},
		{ID: "exp5", Title: "Workshop làm nón Huế", Description: "Trải nghiệm làm nón lá truyền thống cùng nghệ nhân", Category: "Thủ công", Tags: []string{"nón Huế", "thủ công", "truyền thống"}, Rating: 4.8, Price: 200000, Location: "Huế"},
		{ID: "exp6", Title: "Chùa Thiên Mụ & vùng phụ cận", Description: "Tham quan chùa Thiên Mụ và vùng phụ cận bằng xe đạp", Category: "Tâm linh", Tags: []string{"chùa", "tâm linh", "xe đạp"}, Rating: 4.5, Price: 150000, Location: "Huế"},
	}
	for _, e := range experiences {
		s.IndexDocument("experience", e)
	}

	places := []SearchDocument{
		{ID: "place1", Title: "Đại Nội Huế", Description: "Hoàng thành, Tử Cấm Thành", Category: "Di sản", Tags: []string{"UNESCO"}, Rating: 4.9, Location: "TP Huế"},
		{ID: "place2", Title: "Chùa Thiên Mụ", Description: "Ngôi chùa cổ nhất Huế", Category: "Tâm linh", Tags: []string{"chùa"}, Rating: 4.7, Location: "TP Huế"},
		{ID: "place3", Title: "Cầu Trường Tiền", Description: "Biểu tượng Huế", Category: "Kiến trúc", Tags: []string{"cầu", "biểu tượng"}, Rating: 4.6, Location: "TP Huế"},
		{ID: "place4", Title: "Chợ Đông Ba", Description: "Chợ lớn nhất Huế", Category: "Mua sắm", Tags: []string{"chợ"}, Rating: 4.3, Location: "TP Huế"},
	}
	for _, p := range places {
		s.IndexDocument("place", p)
	}

	log.Printf("🔍 [Search] Seeded %d documents", len(experiences)+len(places))
}
