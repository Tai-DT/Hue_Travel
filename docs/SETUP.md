# 🏯 Huế Travel — Setup Guide

Hướng dẫn chi tiết cài đặt và chạy dự án locally.

---

## Prerequisites

| Tool | Version | Cài đặt |
|------|---------|---------|
| **Go** | 1.24+ | [go.dev/dl](https://go.dev/dl/) |
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org/) |
| **Docker** | Latest | [docker.com](https://www.docker.com/) |
| **Expo CLI** | Latest | `npm install -g expo-cli` |

---

## 1. Clone & Setup

```bash
git clone https://github.com/your-org/hue-travel.git
cd hue-travel

# Copy environment file
cp .env.example .env
```

> ⚠️ Mở `.env` và cập nhật các giá trị cần thiết (JWT_SECRET, API keys...)

---

## 2. Khởi động Infrastructure

```bash
# Start PostgreSQL, Redis, MinIO, Meilisearch
docker compose up -d

# Kiểm tra services
docker compose ps
```

Các services:
- **PostgreSQL** — `localhost:5432` (user: huetravel / pass: huetravel_dev_2026)
- **Redis** — `localhost:6379`
- **MinIO** — Console: `localhost:9001`, API: `localhost:9000`
- **Meilisearch** — `localhost:7700`

---

## 3. Database

```bash
# Database tự tạo tables khi API khởi động lần đầu
# Hoặc chạy migrations manually:
make migrate

# Seed data (nếu có):
make seed

# Reset local DB về seed sạch:
make db-reset
```

---

## 4. API Backend (Go)

```bash
cd apps/api

# Download dependencies
go mod download

# Chạy server
go run ./cmd/server

# Hoặc dùng Makefile:
make api
```

Server sẽ chạy tại: `http://localhost:8080`  
Health check: `http://localhost:8080/health`

### Run Tests

```bash
go test ./... -v           # Chạy tất cả tests
go test ./... -race        # Race condition check
go vet ./...               # Static analysis
```

---

## 5. Web Admin (Next.js)

```bash
cd apps/web
npm install
npm run dev
```

Web Admin: `http://localhost:3000`

Tài khoản test:
- Email: `admin@huetravel.local`
- Password: `HueTravel123!`
- Role: `admin`

---

## 6. Provider Portal (Next.js)

```bash
cd apps/provider-portal
npm install
npm run dev -- -p 3001
```

Provider Portal: `http://localhost:3001`

Tài khoản test:
- Email: `guide.demo@huetravel.local`
- Password: `HueTravel123!`
- Role: `guide`

---

## 7. Mobile App (React Native / Expo)

```bash
cd apps/mobile
npm install

# Start Expo dev server
npx expo start
```

Options:
- Press `i` → iOS Simulator
- Press `a` → Android Emulator
- Scan QR → Expo Go trên thiết bị thật

> 💡 Đảm bảo API_URL trong `apps/mobile/src/services/api.ts` trỏ đúng tới backend
> Hoặc khai báo `EXPO_PUBLIC_API_URL=http://localhost:8080/api/v1` trong `.env`

---

## Chạy tất cả cùng lúc

```bash
# Terminal 1: Infrastructure
docker compose up -d

# Terminal 2: API
cd apps/api && go run ./cmd/server

# Terminal 3: Web Admin
cd apps/web && npm run dev

# Terminal 4: Provider Portal
cd apps/provider-portal && npm run dev -- -p 3001

# Terminal 5: Mobile
cd apps/mobile && npx expo start
```

Hoặc dùng Makefile:

```bash
make infra-up # Docker services
make api      # Go API
make seed     # Demo data
make db-reset # Clean local dataset
```

---

## Troubleshooting

### Port đã được sử dụng
```bash
lsof -i :8080  # Tìm process đang dùng port
kill -9 <PID>  # Tắt process
```

### Database connection refused
```bash
docker compose ps          # Check service status
docker compose logs db     # Xem logs PostgreSQL
```

### MinIO access denied
```bash
# Reset MinIO credentials
docker compose down -v
docker compose up -d
```

### Mobile không kết nối API
```bash
# Sử dụng IP máy thay vì localhost:
# Tìm IP: ifconfig | grep "inet "
# Update API_URL: http://192.168.x.x:8080/api/v1
```

---

## Environment Variables

Xem file `.env.example` để biết tất cả biến môi trường cần thiết.

Các biến **bắt buộc** cho development:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `JWT_SECRET` — Secret key cho JWT tokens

Các biến điều khiển mock/strict:
- `ALLOW_MOCK_SERVICES=true` — Cho phép AI/Places/Payment fallback trong local
- `APP_STRICT_MODE=true` — Fail-fast khi thiếu cấu hình bắt buộc

Các biến **tùy chọn** khi đang development:
- `GOONG_API_KEY` — Goong Maps
- `GEMINI_API_KEY` — AI features
- `VNPAY_*` — Payment
- `FCM_SERVER_KEY` — Push notifications

> Khi `APP_STRICT_MODE=true` hoặc `APP_ENV=production`, các integration chính sẽ không được phép chạy mock.
