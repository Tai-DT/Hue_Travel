# Huế Travel — Project Rules

> Rules cho Antigravity AI khi làm việc với dự án Huế Travel.
> Luôn tuân thủ khi generate code, review, hoặc sửa lỗi.

---

## 🏗️ Kiến Trúc Tổng Quan

### Monorepo Structure
```
Hue_Travel/
├── apps/
│   ├── api/            # Go backend (Gin)
│   ├── mobile/         # React Native (Expo SDK 52)
│   ├── web/            # Next.js 15 — Admin Dashboard
│   └── provider-portal/# Next.js 15 — Guide Portal
├── packages/
│   ├── shared/         # Shared types, constants
│   └── ui/             # Shared UI components
├── infrastructure/     # Terraform, K8s configs
├── scripts/            # Dev scripts
├── docker-compose.yml  # Local infra
└── Makefile            # Dev commands
```

### Tech Stack
| Layer | Technology |
|---|---|
| **Backend** | Go 1.23+, Gin, pgx (raw SQL) |
| **Database** | PostgreSQL 16 + pgvector + pg_trgm |
| **Cache** | Redis 7 |
| **Storage** | MinIO (S3-compatible) |
| **Search** | Meilisearch |
| **Mobile** | React Native, Expo SDK 52, React Navigation |
| **Web** | Next.js 15, React 19 |
| **Auth** | JWT (access + refresh tokens) |
| **Payment** | VNPay |
| **AI** | Google Gemini API |
| **Maps** | Google Maps Platform |

---

## 🦫 Backend (Go API) Conventions

### Architecture Pattern
**Clean Architecture**: `handler → service → repository`

```
internal/
├── config/       # Config loading, DB/Redis connections
├── handler/      # HTTP handlers — parse request, call service, format response
├── service/      # Business logic — validation, orchestration
├── repository/   # Data access — raw SQL queries via pgx
├── model/        # Data models (Go structs)
├── middleware/    # Auth, CORS, RateLimit, Recovery, Logger
├── websocket/    # Real-time chat hub
└── migration/    # SQL migration files
```

### Code Style Rules

1. **Naming**
   - Package: lowercase, single word (`handler`, `service`, `repository`)
   - Files: `snake_case.go` (e.g., `review_favorite_guide.go`)
   - Structs: PascalCase (e.g., `ExperienceHandler`, `BookingService`)
   - Methods: PascalCase for exported, camelCase for internal
   - Constants: PascalCase for exported enums (e.g., `RoleTraveler`, `BookingPending`)

2. **Handler Rules**
   - Mỗi handler nhận request, validate input, gọi service/repo, trả response
   - Dùng `response.OK()`, `response.BadRequest()`, `response.NotFound()` etc.
   - Error codes format: `HT-{DOMAIN}-{NUM}` (e.g., `HT-VAL-001`, `HT-AUTH-001`)
   - Lấy user info từ context: `c.Get("user_id")`, `c.Get("user_role")`
   - Không chứa business logic — chuyển xuống service

3. **Service Rules**
   - Chứa toàn bộ business logic
   - Validate business rules (ownership, status checks, etc.)
   - Return `error` với thông báo bằng tiếng Việt cho user-facing errors
   - Có thể gọi nhiều repositories

4. **Repository Rules**
   - Raw SQL via `pgx` — KHÔNG dùng ORM
   - Mọi query phải parametrized (`$1, $2, ...`) — KHÔNG bao giờ string concatenation
   - UUID generation: `uuid.New()` từ `github.com/google/uuid`
   - Timestamps: set `CreatedAt` và `UpdatedAt` trong Go code
   - Return `nil, nil` cho ErrNoRows (thay vì error)

5. **Model Rules**
   - Struct tags: `json` + `db`
   - Optional fields: dùng **pointer** (`*string`, `*time.Time`)
   - Password hash: tag `json:"-"` (never expose)
   - Enums: `type XxxType string` với const block

6. **Middleware Rules**
   - `Auth(jwtSecret)`: validate JWT, set `user_id` + `user_role` in context
   - `WebSocketAuth(jwtSecret)`: JWT from query `?token=` or Sec-WebSocket-Protocol
   - `RequireRole(roles...)`: check role sau Auth
   - `CORS()`: dùng `CORS_ORIGINS` env var hoặc environment-based whitelist
   - `RateLimit(max, window)`: per-IP với `sync.Mutex` — thread-safe

### API Response Format
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": { "page": 1, "per_page": 20, "total": 100 }
}

{
  "success": false,
  "error": { "code": "HT-VAL-001", "message": "..." }
}
```

### Route Conventions
- Base URL: `/api/v1`
- Public routes: no middleware
- Auth routes: `middleware.Auth(cfg.JWT.Secret)`
- Role routes: `middleware.RequireRole("admin")`, `middleware.RequireRole("guide", "admin")`
- Admin routes: **luôn** cần `Auth()` + `RequireRole("admin")`
- Notification routes: **luôn** cần `Auth()`

### Environment Variables
- Load từ `.env` file via `godotenv`
- Access qua `config.Load()` → struct `Config`
- Sensitive values: **KHÔNG** hardcode, dùng env vars
- Default values: chỉ cho development
- Thêm vars mới vào `.env.example` kèm comment

---

## 📱 Mobile (React Native) Conventions

### Structure
```
mobile/
├── App.tsx          # Entry point, navigation
├── screens/         # Screen components
├── components/      # Reusable components
├── hooks/           # Custom hooks
├── services/        # API calls
├── utils/           # Helper functions
└── constants/       # Colors, URLs, etc.
```

### Rules
1. Dùng **Expo SDK 52** — không eject
2. Navigation: `React Navigation` (Stack + Tab)
3. API URL: dùng constant, không hardcode
4. WebSocket: gửi JWT token qua `?token=` query param
5. AsyncStorage cho token persistence
6. TypeScript strict mode

---

## 🌐 Web (Next.js) Conventions

### Structure
```
web/src/
├── app/            # App Router pages
├── components/     # UI components
├── lib/            # API client, utilities
├── hooks/          # Custom hooks
└── styles/         # CSS/Tailwind
```

### Rules
1. **Next.js 15** + React 19 + TypeScript
2. App Router (không Pages Router)
3. Server Components mặc định — `'use client'` chỉ khi cần interactivity
4. API calls: fetch từ backend Go, không dùng Next.js API routes cho business logic
5. Auth: JWT token trong cookie httpOnly hoặc header

---

## 🗄️ Database Conventions

### Schema Rules
1. **Primary keys**: `UUID` (`uuid_generate_v4()`)
2. **Timestamps**: `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ`
3. **Soft delete**: dùng `is_active BOOLEAN DEFAULT TRUE` (không xóa row)
4. **Enums**: PostgreSQL `CREATE TYPE` (e.g., `user_role`, `booking_status`)
5. **Indexes**: LUÔN tạo index cho foreign keys và frequently queried columns
6. **Naming**: `snake_case` cho tables và columns
7. **Triggers**: `trigger_set_updated_at()` cho auto-update `updated_at`
8. **Extensions**: `uuid-ossp`, `pgvector`, `pg_trgm` pre-installed

### Migration Rules
- File: `apps/api/internal/migration/init.sql`
- Thêm table mới: dùng `CREATE TABLE IF NOT EXISTS`
- Thêm index: dùng `CREATE INDEX IF NOT EXISTS`
- Thêm data: dùng `ON CONFLICT DO NOTHING`

---

## 🔒 Security Rules (CRITICAL)

1. **Auth endpoints**: Admin routes PHẢI có `Auth()` + `RequireRole("admin")`
2. **CORS**: KHÔNG dùng `Access-Control-Allow-Origin: *` trong production
3. **WebSocket**: PHẢI dùng JWT auth (KHÔNG raw user_id trong query)
4. **Passwords**: KHÔNG bao giờ log hoặc return password hash
5. **SQL Injection**: LUÔN dùng parameterized queries (`$1, $2, ...`)
6. **Rate Limiting**: PHẢI thread-safe (dùng mutex)
7. **Ownership checks**: Update/Delete PHẢI verify ownership (user_id match)
8. **JWT secret**: LUÔN từ env var, KHÔNG hardcode

---

## 🧪 Testing Rules

### Go Tests
```bash
make api-test   # Run all tests with coverage
```
- Test files: `*_test.go` cùng package
- Naming: `TestServiceName_MethodName`
- Unit tests: không cần DB (mock hoặc nil pool)
- Integration tests: tag `//go:build integration`

### Test Structure
```go
func TestXxx_Yyy(t *testing.T) {
    tests := []struct {
        name    string
        input   Type
        want    Type
        wantErr bool
    }{
        {"case name", input, expected, false},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // test logic
        })
    }
}
```

---

## 🚀 Development Workflow

### Quick Start
```bash
make setup        # First time: copy .env, start infra
make dev          # Start infra + API
make api          # Start API only
make db-shell     # PostgreSQL CLI
```

### Before Committing
1. `cd apps/api && go build ./...` — build passes
2. `cd apps/api && go vet ./...` — no warnings
3. `cd apps/api && go test ./...` — tests pass
4. Check `.env.example` nếu thêm env vars mới

### Git Conventions
- Branch naming: `feature/xxx`, `fix/xxx`, `refactor/xxx`
- Commit messages: English, imperative mood
  - `feat: add notification persistence`
  - `fix: admin endpoints require authentication`
  - `refactor: extract WebSocket auth middleware`
- Mỗi commit phải build + test pass

---

## 📋 Error Code Reference

| Prefix | Domain | Example |
|---|---|---|
| `HT-VAL-` | Validation | `HT-VAL-001` — Invalid input |
| `HT-AUTH-` | Authentication | `HT-AUTH-001` — Token missing/invalid |
| `HT-AUTH-003` | Authorization | Forbidden (wrong role) |
| `HT-RES-` | Resource | `HT-RES-001` — Not found |
| `HT-PAY-` | Payment | `HT-PAY-001` — Payment error |
| `HT-SYS-` | System | `HT-SYS-001` — Internal error |
| `HT-RATE-` | Rate Limit | `HT-RATE-001` — Too many requests |

---

## 🗺️ Feature Roadmap Reference

### ✅ Completed
- Clean architecture (handler/service/repository)
- JWT auth (OTP + Google OAuth)
- Experience CRUD (with ownership check)
- Booking system + VNPay payment
- Real-time chat (WebSocket + JWT)
- AI Trip Planner (Gemini)
- Google Maps Places/Directions
- Reviews + Favorites + Guides
- Admin dashboard (real DB queries)
- Notification system (DB-backed)
- Search (in-memory with Meilisearch ready)
- Rate limiting (thread-safe)
- CORS (environment-based)

### 🔜 Next Phase
- [ ] ESMS.vn SMS integration (replace OTP mock)
- [ ] Meilisearch proper integration
- [ ] MinIO file upload handlers
- [ ] Web Admin full UI (Next.js)
- [ ] Provider Portal UI (Next.js)
- [ ] CI/CD pipeline
- [ ] Swagger/OpenAPI documentation
- [ ] E2E tests
- [ ] Production deployment config
