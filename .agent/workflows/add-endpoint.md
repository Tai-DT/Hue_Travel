---
description: Thêm API endpoint mới cho Huế Travel backend
---

# Thêm API Endpoint Mới

## 1. Define Model (nếu cần)
Thêm struct mới vào `apps/api/internal/model/models.go`:
```go
type MyModel struct {
    ID        uuid.UUID `json:"id" db:"id"`
    // ...fields...
    CreatedAt time.Time `json:"created_at" db:"created_at"`
    UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}
```

## 2. Create DB Table (nếu cần)
Thêm SQL vào `apps/api/internal/migration/init.sql`:
```sql
CREATE TABLE IF NOT EXISTS my_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- ...columns...
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_my_table_xxx ON my_table(xxx);
```

## 3. Create Repository
Thêm vào `apps/api/internal/repository/repositories.go` hoặc file riêng:
```go
type MyRepository struct {
    pool *pgxpool.Pool
}
func NewMyRepository(pool *pgxpool.Pool) *MyRepository { ... }
func (r *MyRepository) Create(ctx context.Context, obj *model.MyModel) error { ... }
func (r *MyRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.MyModel, error) { ... }
```
- Dùng raw SQL với `$1, $2, ...`
- Return `nil, nil` cho ErrNoRows

## 4. Create Service (nếu cần business logic)
File: `apps/api/internal/service/my_service.go`
```go
type MyService struct { repo *repository.MyRepository }
func NewMyService(repo *repository.MyRepository) *MyService { ... }
```

## 5. Create Handler
File: `apps/api/internal/handler/my_handler.go`
```go
type MyHandler struct { ... }
func NewMyHandler(...) *MyHandler { ... }
func (h *MyHandler) Create(c *gin.Context) { ... }
func (h *MyHandler) List(c *gin.Context) { ... }
```
- Dùng `response.OK()`, `response.BadRequest()` etc.
- Error codes: `HT-{DOMAIN}-{NUM}`

## 6. Register Routes
Trong `apps/api/cmd/server/main.go`:
```go
// Initialize handler
myH := handler.NewMyHandler(...)

// Register routes
my := v1.Group("/my-resource")
my.Use(middleware.Auth(cfg.JWT.Secret))  // nếu cần auth
{
    my.GET("", myH.List)
    my.POST("", myH.Create)
}
```

## 7. Build & Test
// turbo
```bash
cd apps/api && go build ./... && go vet ./...
```

## 8. Update API Docs
Thêm endpoint vào `apps/api/internal/handler/docs.go`.
