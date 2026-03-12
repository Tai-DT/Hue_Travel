---
description: Chạy dự án Huế Travel locally — infra + API + mobile
---

# Dev Workflow

## 1. Start Infrastructure
// turbo
```bash
make infra-up
```
Chờ 5s cho PostgreSQL ready.

## 2. Run Database Migration (lần đầu hoặc khi có schema mới)
```bash
make migrate
```

## 3. Start Go API Server
// turbo
```bash
make api
```
API sẽ chạy ở `http://localhost:8080`

## 4. (Optional) Start Mobile App
```bash
cd apps/mobile && npx expo start
```

## 5. (Optional) Start Web Admin
```bash
cd apps/web && npm run dev
```

## 6. Verify
// turbo
```bash
curl http://localhost:8080/health
```
Expected: `{"success":true,"data":{"status":"healthy",...}}`
