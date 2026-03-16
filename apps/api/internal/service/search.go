package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ============================================
// Search Service — Full-text Search
// Supports Meilisearch or fallback to in-memory
// ============================================

type SearchService struct {
	meilisearchURL  string
	masterKey       string
	indexed         map[string][]SearchDocument
	mu              sync.RWMutex
	httpClient      *http.Client
	fallbackEnabled bool
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
	Documents  []SearchDocument   `json:"documents"`
	TotalCount int                `json:"total_count"`
	Query      string             `json:"query"`
	TimeMs     int64              `json:"time_ms"`
	Facets     map[string][]Facet `json:"facets,omitempty"`
}

type Facet struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

type SearchFilters struct {
	Type      string   `json:"type,omitempty"`
	Category  string   `json:"category,omitempty"`
	MinPrice  int64    `json:"min_price,omitempty"`
	MaxPrice  int64    `json:"max_price,omitempty"`
	MinRating float64  `json:"min_rating,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	Location  string   `json:"location,omitempty"`
	Limit     int      `json:"limit,omitempty"`
	Offset    int      `json:"offset,omitempty"`
}

func NewSearchService(meilisearchURL, masterKey string) *SearchService {
	return NewSearchServiceWithFallback(meilisearchURL, masterKey, true)
}

func NewSearchServiceWithFallback(meilisearchURL, masterKey string, fallbackEnabled bool) *SearchService {
	s := &SearchService{
		meilisearchURL:  meilisearchURL,
		masterKey:       masterKey,
		indexed:         make(map[string][]SearchDocument),
		httpClient:      &http.Client{Timeout: 5 * time.Second},
		fallbackEnabled: fallbackEnabled,
	}

	if s.IsConfigured() {
		log.Printf("✅ Meilisearch configured: %s", meilisearchURL)
		// Setup index settings
		s.setupMeilisearchIndex()
	} else {
		log.Println("⚠️ Meilisearch not configured — using in-memory search")
	}

	if fallbackEnabled {
		s.seedMockData()
	}
	return s
}

func (s *SearchService) IsConfigured() bool {
	return s.meilisearchURL != "" && s.masterKey != ""
}

// setupMeilisearchIndex creates the index with searchable/filterable attributes
func (s *SearchService) setupMeilisearchIndex() {
	// Create index if not exists
	body := `{"uid": "hue_travel", "primaryKey": "id"}`
	req, _ := http.NewRequest("POST", s.meilisearchURL+"/indexes", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.masterKey)
	s.httpClient.Do(req) //nolint:errcheck // best-effort

	// Set searchable attributes
	searchable := `["title", "description", "category", "tags", "location"]`
	req, _ = http.NewRequest("PUT", s.meilisearchURL+"/indexes/hue_travel/settings/searchable-attributes", strings.NewReader(searchable))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.masterKey)
	s.httpClient.Do(req) //nolint:errcheck

	// Set filterable attributes
	filterable := `["type", "category", "price", "rating", "location"]`
	req, _ = http.NewRequest("PUT", s.meilisearchURL+"/indexes/hue_travel/settings/filterable-attributes", strings.NewReader(filterable))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.masterKey)
	s.httpClient.Do(req) //nolint:errcheck

	log.Println("✅ Meilisearch index 'hue_travel' configured")
}

// ============================================
// Search
// ============================================

func (s *SearchService) IsReady() bool {
	return s.IsConfigured() || s.fallbackEnabled
}

func (s *SearchService) Search(ctx context.Context, query string, filters SearchFilters) (SearchResult, error) {
	start := time.Now()

	if s.IsConfigured() {
		result, err := s.searchMeilisearch(ctx, query, filters)
		if err == nil {
			return *result, nil
		}
		if !s.fallbackEnabled {
			return SearchResult{}, fmt.Errorf("%w: Meilisearch query failed: %v", ErrServiceUnavailable, err)
		}
		log.Printf("⚠️ Meilisearch search failed: %v — falling back to in-memory", err)
	} else if !s.fallbackEnabled {
		return SearchResult{}, fmt.Errorf("%w: Meilisearch is not configured", ErrServiceNotConfigured)
	}

	// Fallback: in-memory search
	var results []SearchDocument
	queryLower := strings.ToLower(query)

	s.mu.RLock()
	for _, docs := range s.indexed {
		for _, doc := range docs {
			if s.matchesQuery(doc, queryLower) && s.matchesFilters(doc, filters) {
				results = append(results, doc)
			}
		}
	}
	s.mu.RUnlock()

	// Apply limit/offset
	limit := filters.Limit
	if limit == 0 {
		limit = 20
	}
	offset := filters.Offset

	total := len(results)
	if offset < len(results) {
		end := offset + limit
		if end > len(results) {
			end = len(results)
		}
		results = results[offset:end]
	} else {
		results = nil
	}

	facets := s.buildFacets(query, queryLower)

	return SearchResult{
		Documents:  results,
		TotalCount: total,
		Query:      query,
		TimeMs:     time.Since(start).Milliseconds(),
		Facets:     facets,
	}, nil
}

// searchMeilisearch calls the Meilisearch multi-search API
func (s *SearchService) searchMeilisearch(ctx context.Context, query string, filters SearchFilters) (*SearchResult, error) {
	// Build filter string
	var filterParts []string
	if filters.Type != "" {
		filterParts = append(filterParts, fmt.Sprintf(`type = "%s"`, filters.Type))
	}
	if filters.Category != "" {
		filterParts = append(filterParts, fmt.Sprintf(`category = "%s"`, filters.Category))
	}
	if filters.MinPrice > 0 {
		filterParts = append(filterParts, fmt.Sprintf(`price >= %d`, filters.MinPrice))
	}
	if filters.MaxPrice > 0 {
		filterParts = append(filterParts, fmt.Sprintf(`price <= %d`, filters.MaxPrice))
	}
	if filters.MinRating > 0 {
		filterParts = append(filterParts, fmt.Sprintf(`rating >= %f`, filters.MinRating))
	}

	limit := filters.Limit
	if limit == 0 {
		limit = 20
	}

	reqBody := map[string]interface{}{
		"q":      query,
		"limit":  limit,
		"offset": filters.Offset,
		"facets": []string{"type", "category"},
	}
	if len(filterParts) > 0 {
		reqBody["filter"] = strings.Join(filterParts, " AND ")
	}

	bodyBytes, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, "POST", s.meilisearchURL+"/indexes/hue_travel/search", strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.masterKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("meilisearch returned status %d", resp.StatusCode)
	}

	var msResult struct {
		Hits               []SearchDocument          `json:"hits"`
		EstimatedTotalHits int                       `json:"estimatedTotalHits"`
		ProcessingTimeMs   int64                     `json:"processingTimeMs"`
		FacetDistribution  map[string]map[string]int `json:"facetDistribution"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&msResult); err != nil {
		return nil, err
	}

	// Convert facets
	facets := make(map[string][]Facet)
	for facetName, distribution := range msResult.FacetDistribution {
		for value, count := range distribution {
			facets[facetName] = append(facets[facetName], Facet{Value: value, Count: count})
		}
	}

	return &SearchResult{
		Documents:  msResult.Hits,
		TotalCount: msResult.EstimatedTotalHits,
		Query:      query,
		TimeMs:     msResult.ProcessingTimeMs,
		Facets:     facets,
	}, nil
}

func (s *SearchService) matchesQuery(doc SearchDocument, query string) bool {
	if query == "" {
		return true
	}
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
		if strings.Contains(strings.ToLower(t), query) {
			return true
		}
	}
	return false
}

func (s *SearchService) matchesFilters(doc SearchDocument, f SearchFilters) bool {
	if f.Type != "" && doc.Type != f.Type {
		return false
	}
	if f.Category != "" && !strings.EqualFold(doc.Category, f.Category) {
		return false
	}
	if f.MinPrice > 0 && doc.Price < f.MinPrice {
		return false
	}
	if f.MaxPrice > 0 && doc.Price > f.MaxPrice {
		return false
	}
	if f.MinRating > 0 && doc.Rating < f.MinRating {
		return false
	}
	if f.Location != "" && !strings.Contains(strings.ToLower(doc.Location), strings.ToLower(f.Location)) {
		return false
	}
	return true
}

func (s *SearchService) buildFacets(query, queryLower string) map[string][]Facet {
	categories := make(map[string]int)
	types := make(map[string]int)

	s.mu.RLock()
	for _, docs := range s.indexed {
		for _, doc := range docs {
			if s.matchesQuery(doc, queryLower) {
				categories[doc.Category]++
				types[doc.Type]++
			}
		}
	}
	s.mu.RUnlock()

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
	if limit == 0 {
		limit = 5
	}
	queryLower := strings.ToLower(query)
	suggestions := make(map[string]bool)

	s.mu.RLock()
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
	s.mu.RUnlock()

	var result []string
	for sg := range suggestions {
		if len(result) >= limit {
			break
		}
		result = append(result, sg)
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
	s.mu.Lock()
	s.indexed[docType] = append(s.indexed[docType], doc)
	s.mu.Unlock()

	// Also index to Meilisearch if configured
	if s.IsConfigured() {
		bodyBytes, _ := json.Marshal([]SearchDocument{doc})
		req, _ := http.NewRequest("POST", s.meilisearchURL+"/indexes/hue_travel/documents", strings.NewReader(string(bodyBytes)))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+s.masterKey)
		resp, err := s.httpClient.Do(req)
		if err != nil {
			log.Printf("⚠️ Meilisearch index failed: %v", err)
		} else {
			resp.Body.Close()
		}
	}
}

func (s *SearchService) GetStats() map[string]int {
	stats := make(map[string]int)
	total := 0
	s.mu.RLock()
	for k, v := range s.indexed {
		stats[k] = len(v)
		total += len(v)
	}
	s.mu.RUnlock()
	stats["total"] = total
	return stats
}

// ============================================
// Sync from PostgreSQL Database
// ============================================

// SyncFromDB indexes all experiences from the database into search.
// Called on startup when DB is available.
func (s *SearchService) SyncFromDB(ctx context.Context, pool interface {
	Query(ctx context.Context, sql string, args ...interface{}) (interface{ Next() bool; Scan(dest ...interface{}) error; Close() }, error)
}) {
	if pool == nil {
		log.Println("⚠️ [Search] No DB pool — skipping sync")
		return
	}

	log.Println("🔄 [Search] Syncing from database...")

	// This method is intentionally simple — it uses the raw pgxpool.Pool pattern
	// but accepts an interface for testability
	s.syncExperiencesFromDB(ctx, pool)
	s.syncPlacesFromDB(ctx)

	log.Printf("✅ [Search] Sync complete — %d documents indexed", s.GetStats()["total"])
}

// SyncExperiencesFromPool syncs experiences from a pgxpool.Pool
func (s *SearchService) SyncExperiencesFromPool(ctx context.Context, pool interface{}) {
	// Type-assert to pgxpool.Pool
	type querier interface {
		Query(ctx context.Context, sql string, args ...interface{}) (interface{ Next() bool; Scan(dest ...interface{}) error; Close() }, error)
	}
	if q, ok := pool.(querier); ok {
		s.syncExperiencesFromDB(ctx, q)
	}
}

func (s *SearchService) syncExperiencesFromDB(ctx context.Context, pool interface {
	Query(ctx context.Context, sql string, args ...interface{}) (interface{ Next() bool; Scan(dest ...interface{}) error; Close() }, error)
}) {
	rows, err := pool.Query(ctx, `
		SELECT id, title, COALESCE(description, ''), COALESCE(category, ''),
			   COALESCE(price, 0), COALESCE(rating, 0), COALESCE(location, '')
		FROM experiences WHERE is_active = TRUE`)
	if err != nil {
		log.Printf("⚠️ [Search] Failed to query experiences: %v", err)
		return
	}
	defer rows.Close()

	count := 0
	var docs []SearchDocument
	for rows.Next() {
		var doc SearchDocument
		var price int64
		rows.Scan(&doc.ID, &doc.Title, &doc.Description, &doc.Category,
			&price, &doc.Rating, &doc.Location)
		doc.Type = "experience"
		doc.Price = price
		doc.CreatedAt = time.Now()
		docs = append(docs, doc)
		count++
	}

	if len(docs) > 0 {
		s.BulkIndex("experience", docs)
		log.Printf("🔍 [Search] Indexed %d experiences from DB", count)
	}
}

func (s *SearchService) syncPlacesFromDB(_ context.Context) {
	// Places come from Goong maps, not DB — keep mock data as fallback
	// In production, this would sync from a places cache table
}

// BulkIndex indexes multiple documents at once.
func (s *SearchService) BulkIndex(docType string, docs []SearchDocument) {
	for i := range docs {
		docs[i].Type = docType
		if docs[i].CreatedAt.IsZero() {
			docs[i].CreatedAt = time.Now()
		}
	}

	s.mu.Lock()
	s.indexed[docType] = docs
	s.mu.Unlock()

	// Also bulk-push to Meilisearch if configured
	if s.IsConfigured() && len(docs) > 0 {
		bodyBytes, _ := json.Marshal(docs)
		req, _ := http.NewRequest("POST", s.meilisearchURL+"/indexes/hue_travel/documents", strings.NewReader(string(bodyBytes)))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+s.masterKey)
		resp, err := s.httpClient.Do(req)
		if err != nil {
			log.Printf("⚠️ [Search] Meilisearch bulk index failed: %v", err)
		} else {
			resp.Body.Close()
			log.Printf("✅ [Search] Pushed %d %s docs to Meilisearch", len(docs), docType)
		}
	}
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
