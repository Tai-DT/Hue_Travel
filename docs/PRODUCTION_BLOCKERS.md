# Production Blockers

Ngày rà soát: 2026-03-17

## Đã sửa trong lượt này

- `ALLOW_MOCK_SERVICES` đã được nối vào wiring service trong `apps/api/internal/app/container.go`
  - AI, places, payment, search, upload không còn mặc định fallback/mock nếu môi trường production đặt `ALLOW_MOCK_SERVICES=false`
- Weather đã được refactor để production không còn silent mock
  - `apps/api/internal/service/weather.go` nay dùng `fallbackEnabled`
  - khi `ALLOW_MOCK_SERVICES=false`, weather trả `ErrServiceNotConfigured` hoặc `ErrServiceUnavailable`
  - `apps/api/internal/handler/weather.go` map lỗi này sang `503 Service Unavailable`
  - `apps/api/internal/config/config.go` nay yêu cầu `OPENWEATHER_API_KEY` trong strict mode
- Push notification đã được chuyển sang fail-fast ở strict mode
  - `apps/api/internal/config/config.go` nay yêu cầu `FCM_SERVER_KEY` trong strict mode
  - `apps/api/internal/service/notification.go` kiểm tra cấu hình chặt hơn và log rõ khi local/dev không có FCM
- Notification handler không còn mock fallback khi production tắt mock
  - `apps/api/internal/handler/notification.go` nay chỉ fallback mock khi `ALLOW_MOCK_SERVICES=true`
  - khi `ALLOW_MOCK_SERVICES=false`, các endpoint notifications trả `503 Service Unavailable` nếu DB/path chưa sẵn sàng
- AI Quick Suggest đã chuyển sang fail-fast ở strict mode
  - `apps/api/internal/handler/ai.go` nay chỉ trả curated static suggestions khi `ALLOW_MOCK_SERVICES=true`
  - khi `ALLOW_MOCK_SERVICES=false`, endpoint quick suggest trả `503 Service Unavailable` nếu thiếu Gemini key hoặc AI trả dữ liệu không parse được
- Search production path đã được khóa theo Meilisearch thật
  - `apps/api/internal/service/search.go` nay dùng Meilisearch cho `search`, `suggest`, `trending`, `stats` khi `ALLOW_MOCK_SERVICES=false`
  - `apps/api/internal/app/container.go` nay sync experiences từ PostgreSQL sang search index lúc startup
  - local/dev vẫn giữ in-memory/static fallback, nhưng strict mode không còn dùng path này
- Health check trong `apps/api/Dockerfile` đã sửa từ `/api/v1/health` sang `/health`
- Cấu hình deploy đã được đồng bộ:
  - thêm `OPENWEATHER_API_KEY` vào `deploy/docker-compose.prod.yml`
  - thêm `VNPAY_RETURN_URL` vào `deploy/docker-compose.prod.yml`
  - cập nhật `deploy/.env.example`
  - sửa `docs/DEPLOY.md` cho đúng endpoint health, env weather và callback URL của VNPay
  - `apps/api/internal/config/config.go` nay reject `VNPAY_RETURN_URL` local/default khi strict mode bật

## Blocker còn lại

### P0 — VNPay production callback thật chưa được chốt

Evidence:
- `apps/api/internal/service/vnpay.go`
  - `CreatePaymentURL()` vẫn trả mock payment URL nếu thiếu `tmnCode` / `hashSecret`
  - `VerifyCallback()` vẫn auto-verify trong mock mode khi chưa có credentials thật

Impact:
- Booking local đang pass nhờ mock path, nhưng production chưa thể coi là chốt nếu chưa có credential thật và callback thật từ VNPay.

Việc cần làm:
- Cấp `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_RETURN_URL` thật và test callback end-to-end.

### P1 — AI planner / AI chat vẫn cần Gemini key thật và UAT upstream

Evidence:
- `apps/api/internal/service/ai_trip_planner.go`
  - `GenerateTripPlan()` và `Chat()` đã fail-fast khi `ALLOW_MOCK_SERVICES=false`
  - quick suggest đã theo cùng hướng strict mode ở `apps/api/internal/handler/ai.go`

Impact:
- Production path hiện đã an toàn hơn, nhưng các tính năng AI sẽ trả `503` nếu chưa cấp Gemini key thật hoặc upstream lỗi.

Việc cần làm:
- Cấp `GEMINI_API_KEY` thật và chạy UAT cho trip planner, AI chat, quick suggest với upstream thật.

## Nhận xét quan trọng

- Sau patch trong lượt này, production compose đã đúng ý hơn:
  - `APP_ENV=production`
  - `APP_STRICT_MODE=true`
  - `ALLOW_MOCK_SERVICES=false`
- Các vùng weather, push config, notification fallback và AI quick suggest đã được xử lý theo hướng fail-fast.
- Search, upload và places/maps đã được xác minh thêm ở local với path thật.
- Phần còn lại chủ yếu là integration thật và UAT production-like cho payment và AI.

## Thứ tự nên làm tiếp

1. Chốt VNPay production callback thật.
2. Cấp Gemini key thật và test production-like.
3. Viết smoke/UAT riêng cho notifications device registration với DB thật và FCM thật.
4. Viết smoke/UAT cho social và realtime flows.
