# 🏯 Huế Travel

> Nền tảng du lịch thông minh cho cố đô Huế — AI-powered travel platform

[![CI/CD](https://github.com/your-org/hue-travel/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/hue-travel/actions)

## 🌟 Tổng Quan

Huế Travel là nền tảng kết nối du khách với hướng dẫn viên địa phương, cung cấp trải nghiệm du lịch độc đáo tại Huế. Hệ thống bao gồm:

- **📱 Mobile App** — React Native (Expo) cho du khách
- **🌐 Web Admin** — Next.js dashboard quản trị
- **🧭 Provider Portal** — Next.js cho hướng dẫn viên
- **⚡ API Backend** — Go (Gin) REST API + WebSocket

## 🏗️ Kiến Trúc

```
Huế Travel
├── apps/
│   ├── api/              # Go API (Gin, pgx, Redis)
│   ├── mobile/           # React Native (Expo)
│   ├── web/              # Next.js Admin Dashboard
│   └── provider-portal/  # Next.js Provider Portal
├── deploy/
│   ├── docker-compose.prod.yml
│   ├── nginx/
│   └── .env.example
└── .github/workflows/ci.yml
```

## 🚀 Quick Start

### Prerequisites
- Go 1.24+
- Node.js 20+
- Docker & Docker Compose
- Expo CLI

### 1. Infrastructure
```bash
docker compose up -d  # PostgreSQL, Redis, MinIO, Meilisearch
```

### 2. API
```bash
cd apps/api
cp ../../.env.example .env  # Edit config
go run ./cmd/server
```

Seed demo data:
```bash
make seed
```

Reset local DB to a clean dev dataset:
```bash
make db-reset
```

### 3. Mobile App
```bash
cd apps/mobile
npm install
npx expo start
```

### 4. Web Admin
```bash
cd apps/web
npm install
npm run dev  # http://localhost:3000
```

### 5. Provider Portal
```bash
cd apps/provider-portal
npm install
npm run dev  # http://localhost:3001
```

## 📊 API Endpoints (100+ endpoints)

| Category | Count | Description |
|---|---|---|
| Auth | 5 | Email/password register, login, refresh, logout |
| User | 3 | Profile, update, device token |
| Experiences | 5 | CRUD, search, filter |
| Bookings | 7 | Create, confirm, complete, cancel, guide |
| Places | 3 | Search, nearby, directions (Goong Maps) |
| Chat | 5 | Rooms, messages, read, WebSocket |
| Reviews | 4 | Create, list, featured |
| Favorites | 3 | Toggle, list |
| Search | 3 | Full-text (Meilisearch), suggest, trending |
| Notifications | 4 | List, unread, mark read, device token |
| AI | 4 | Trip plan, chat, suggest, translate |
| Upload | 2 | File, avatar (MinIO) |
| Payment | 3 | VNPay create, callback, methods |
| Admin | 12 | Dashboard, users, experiences, bookings, reviews, reports |
| Guides | 4 | Top, profile, direct booking, update |
| Friends | 7 | Request, accept, decline, unfriend, list, pending, status |
| Trips | 12 | Create, discover, invite, join, leave, invitations |
| Feed/Stories | 6 | Create, list, like, comment, delete |
| Blog | 7 | Posts, trending, create, like, comments |
| Diary | 3 | Create, my entries, public entries |
| Events | 3 | List, detail, RSVP |
| Emergency | 4 | SOS, cancel, contacts, hospitals |
| Calls | 8 | Initiate, answer, decline, end, leave, participants, history |
| Reactions | 2 | Toggle, list |
| Gamification | 6 | Achievements, leaderboard, check-in, stats |
| Promotions | 4 | Active, create, apply, my coupons |
| Weather | 3 | Current, forecast, best time |
| Translate | 3 | Translate, detect, phrasebook |
| Collections | 6 | Create, list, add/remove items, delete |
| Report/Block | 4 | Report, block, unblock, list |
| Guide Apply | 2 | Apply, status |
| Health | 1 | Server health check |

## 🔧 Services Integration

| Service | Purpose | SDK |
|---|---|---|
| PostgreSQL 16 | Primary database | pgx/v5 |
| Redis 7 | Cache, sessions | go-redis/v9 |
| MinIO | File storage (S3) | minio-go/v7 |
| Meilisearch | Full-text search | HTTP API |
| Firebase FCM | Push notifications | HTTP API |
| Gemini | AI trip planning | REST API |
| VNPay | Payment gateway | HTTP API |
| Goong Maps | Maps, places, directions | REST API |

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [API Reference](docs/API.md) | 39+ endpoints, request/response examples |
| [Setup Guide](docs/SETUP.md) | Hướng dẫn cài đặt development |
| [Deploy Guide](docs/DEPLOY.md) | Production deployment, SSL, backup |

## 🧪 Testing

```bash
cd apps/api
go test ./... -v          # 48+ unit/handler tests
go test ./... -race       # Race condition detection

# Validate local infra + schema after docker compose up
make smoke

# Validate API public endpoints
make smoke-api

# Validate email/password auth -> refresh -> logout flow
make smoke-auth

# Validate email/password auth -> booking -> payment create -> logout flow
make smoke-booking
```

`make smoke-auth` supports `EMAIL`, `PASSWORD`, and `FULL_NAME`. If `EMAIL` is omitted, it auto-registers a fresh local account.

`make smoke-booking` supports `EMAIL`, `PASSWORD`, `FULL_NAME`, `BOOKING_DATE`, `EXPERIENCE_ID`, `EXPERIENCE_QUERY`, and `BANK_CODE`. If `EMAIL` is omitted, it auto-registers a traveler account before creating the booking. In local mock-payment mode, the script also verifies that the booking becomes `confirmed` immediately after payment creation.

## ⚙️ Runtime Modes

- `ALLOW_MOCK_SERVICES=true`: chỉ nên bật rõ ràng khi cần mock AI, Maps, SMS, Payment trong local development.
- `APP_STRICT_MODE=true` hoặc `APP_ENV=production`: API fail-fast nếu thiếu config quan trọng và không trả dữ liệu mock.
- `EXPO_PUBLIC_API_URL`: cho phép mobile web/export trỏ đúng API local thay vì domain production.

## 🗃️ Schema Source

- Canonical PostgreSQL schema nằm ở `apps/api/migrations/001_initial_schema.sql`.
- `docker compose up` và `make migrate` đều dùng cùng file này để tránh drift giữa local init và manual migrate.

## 🐳 Production Deploy

```bash
cd deploy
cp .env.example .env      # Configure secrets
docker compose -f docker-compose.prod.yml up -d
```

Services:
- `api.huetravel.vn` → API (port 8080)
- `admin.huetravel.vn` → Web Admin (port 3000)
- `provider.huetravel.vn` → Provider Portal (port 3001)

## 📱 Mobile Build

```bash
cd apps/mobile
eas build --platform all
eas submit --platform all
```

## 📄 License

MIT © 2026 Huế Travel Team
