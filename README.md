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

## 📊 API Endpoints (63 endpoints)

| Category | Count | Description |
|---|---|---|
| Auth | 6 | OTP, Google, refresh, logout |
| User | 3 | Profile, update, device token |
| Experiences | 5 | CRUD, search, filter |
| Bookings | 7 | Create, confirm, complete, cancel, guide |
| Places | 3 | Search, nearby, detail |
| Chat | 5 | Rooms, messages, WebSocket |
| Reviews | 4 | Create, list, featured |
| Favorites | 3 | Add, remove, list |
| Search | 3 | Full-text, suggest, trending |
| Notifications | 3 | List, mark read, device |
| AI | 4 | Trip plan, guide, translate |
| Upload | 2 | File, avatar |
| Payment | 3 | VNPay create, callback, verify |
| Admin | 8 | Users, experiences, bookings CRUD |
| Health | 1 | Server health check |
| Guides | 3 | List, profile, ratings |

## 🔧 Services Integration

| Service | Purpose | SDK |
|---|---|---|
| PostgreSQL 16 | Primary database | pgx/v5 |
| Redis 7 | Cache, sessions, OTP | go-redis/v9 |
| MinIO | File storage (S3) | minio-go/v7 |
| Meilisearch | Full-text search | HTTP API |
| Firebase FCM | Push notifications | HTTP API |
| ESMS.vn | SMS OTP | REST API |
| Gemini | AI trip planning | REST API |
| VNPay | Payment gateway | HTTP API |
| Google Maps | Maps & geocoding | JS SDK |

## 🧪 Testing

```bash
cd apps/api
go test ./... -v          # 41 unit tests
go test ./... -race       # Race condition detection
```

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
