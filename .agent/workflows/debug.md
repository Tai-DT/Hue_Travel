---
description: Debug lỗi trong dự án Huế Travel
---

# Debug Workflow

## 1. Xác định loại lỗi

### Build Error
// turbo
```bash
cd apps/api && go build ./... 2>&1
```

### Runtime Error
Kiểm tra logs khi chạy API:
```bash
make api 2>&1 | tail -50
```

### Test Failure
// turbo
```bash
cd apps/api && go test ./... -v -run TestNameHere
```

## 2. Check Infrastructure
// turbo
```bash
docker compose ps
```
Đảm bảo PostgreSQL và Redis đang chạy.

## 3. Check Database Connection
```bash
make db-shell
```
Sau đó:
```sql
SELECT COUNT(*) FROM users;
\dt  -- list all tables
```

## 4. Check API Health
// turbo
```bash
curl -s http://localhost:8080/health | python3 -m json.tool
```

## 5. Test Specific Endpoint
```bash
# Public endpoint
curl -s http://localhost:8080/api/v1/experiences | python3 -m json.tool

# Auth endpoint (cần token)
TOKEN="your-jwt-token-here"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/me | python3 -m json.tool
```

## 6. Check Logs
Xem Go API output cho error messages. Look for:
- `⚠️` — warnings
- `🔥 PANIC` — crash recovery
- `📣 [NOTIF]` — notification events
- `🔍 [Search]` — search events
- `📱 OTP` — OTP codes (dev only)

## 7. Fix & Verify
Sau khi fix, luôn chạy:
// turbo
```bash
cd apps/api && go build ./... && go vet ./... && go test ./...
```
