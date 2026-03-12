# 🏯 Huế Travel — Nền tảng Du lịch Thông minh

> Ứng dụng du lịch Huế tích hợp AI, thanh toán VNPay, real-time chat, và bản đồ Google Maps.

---

## 🏗️ Kiến trúc

```
┌──────────────────────────────────────────────────────┐
│                    Clients                            │
│  📱 Mobile App    🖥️ Web Admin    🧭 Provider Portal  │
│  (React Native)  (Next.js:3000)  (Next.js:3001)     │
└──────────┬───────────┬──────────────┬────────────────┘
           │           │              │
           ▼           ▼              ▼
┌──────────────────────────────────────────────────────┐
│              ⚙️ Go API Server (:8080)                 │
│  ┌─────────┬──────────┬──────────┬─────────────┐    │
│  │  Auth   │ Booking  │   AI    │   Search    │    │
│  │  OTP    │ VNPay    │ Gemini  │ Meilisearch │    │
│  │  OAuth  │ CRUD     │ Chat    │ Full-text   │    │
│  └─────────┴──────────┴──────────┴─────────────┘    │
│           WebSocket Hub (real-time)                   │
└──────┬──────────┬──────────┬─────────┬───────────────┘
       │          │          │         │
       ▼          ▼          ▼         ▼
   PostgreSQL   Redis     MinIO   Meilisearch
    (pgvector)  (cache)   (files)  (search)
```

## 📊 Project Stats

| Component | Files | Details |
|-----------|-------|---------|
| Backend Go | 27 | 49 endpoints, 12 handlers, 9 services |
| Mobile RN | 15 | 13 screens |
| Web Admin | 3 | Next.js 15 dashboard |
| Provider Portal | 3 | Next.js guide dashboard |
| Infrastructure | 2 | Docker Compose, Dockerfile |

## 🚀 Quick Start

### Prerequisites

- Go 1.22+
- Node.js 20+
- Docker & Docker Compose
- Expo CLI (`npm install -g expo-cli`)

### 1. Clone & Setup

```bash
git clone https://github.com/your-repo/hue-travel.git
cd hue-travel
cp .env.example .env
# Edit .env with your API keys
```

### 2. Start Infrastructure

```bash
docker compose up -d
# PostgreSQL :5432 | Redis :6379 | MinIO :9000/:9001 | Meilisearch :7700
```

### 3. Run Backend API

```bash
cd apps/api
go mod tidy
go run cmd/server/main.go
# → http://localhost:8080
# → API docs: http://localhost:8080/api/v1/docs
```

### 4. Run Mobile App

```bash
cd apps/mobile
npm install
npx expo start
# Scan QR code with Expo Go app
```

### 5. Run Web Admin

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

### 6. Run Provider Portal

```bash
cd apps/provider-portal
npm install
npm run dev
# → http://localhost:3001
```

## 📱 Mobile Screens

| Screen | Description |
|--------|-------------|
| Welcome | 3 onboarding slides |
| Login | Phone OTP + Google OAuth |
| Home | Hero, categories, trending, nearby |
| Explore | Search, filters, experience cards |
| Map | Interactive Google Maps, pins |
| AI Guide | Chat with Gemini AI |
| Booking | 3-tab booking management |
| Chat | Real-time rooms & messages |
| Notification | Color-coded, 10 types |
| Payment | 4-step VNPay flow |
| Settings | Toggles, security, app info |
| Profile | XP level, stats |
| Experience Detail | Full detail + booking CTA |

## ⚙️ API Endpoints (49)

| Category | # | Endpoints |
|----------|---|-----------|
| Auth | 4 | OTP send/verify, Google OAuth, Token refresh |
| Experiences | 4 | List, Detail, Create, Update |
| Places | 3 | Search, Nearby, Directions |
| AI | 3 | Trip plan, Chat, Suggestions |
| Bookings | 4 | Create, List, Detail, Cancel |
| Payment | 3 | Methods, Create VNPay, Callback |
| Reviews | 2 | List, Create |
| Favorites | 2 | Toggle, List |
| Guides | 2 | Top, Detail |
| Chat | 5 | Rooms CRUD, Messages, Read status |
| Notifications | 4 | List, Unread, Mark read, FCM register |
| Admin | 3 | Dashboard, Health, Quick stats |
| Search | 4 | Full-text, Suggest, Trending, Stats |
| Profile | 1 | Current user |
| System | 3 | Health, WebSocket, Docs |

## 🗃️ Database Schema

10 tables with pgvector support:
- `users` — Auth, profile, XP level
- `experiences` — Tour listings
- `bookings` — Reservations + payment
- `reviews` — Star ratings + text
- `favorites` — Bookmarks
- `guides` — Tour guides
- `chat_rooms` + `chat_messages` — Real-time chat
- `notifications` — Push notifications
- `devices` — FCM tokens

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go, Gin, GORM, PostgreSQL, Redis |
| Mobile | React Native, Expo, TypeScript |
| Web | Next.js 15, React 19, TypeScript |
| AI | Google Gemini API |
| Maps | Google Maps Platform |
| Payment | VNPay (sandbox) |
| Search | Meilisearch |
| Storage | MinIO (S3) |
| Real-time | WebSocket |
| Infra | Docker Compose |

## 📄 License

MIT License — Built with ❤️ in Huế
