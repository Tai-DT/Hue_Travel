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
- Health check trong `apps/api/Dockerfile` đã sửa từ `/api/v1/health` sang `/health`
- Cấu hình deploy đã được đồng bộ:
  - thêm `OPENWEATHER_API_KEY` vào `deploy/docker-compose.prod.yml`
  - cập nhật `deploy/.env.example`
  - sửa `docs/DEPLOY.md` cho đúng endpoint health và env weather

## Blocker còn lại

### P0 — Push notification có thể im lặng không gửi

Evidence:
- `apps/api/internal/service/notification.go`
  - nếu không có `FCM_SERVER_KEY`, service chỉ log local và return
- `apps/api/internal/config/config.go`
  - strict validation chưa yêu cầu `FCM_SERVER_KEY`

Impact:
- Người dùng vẫn thấy app hoạt động nhưng push không được gửi.
- Rất dễ bị miss trong UAT nếu chỉ test API response.

Việc cần làm:
- Quyết định rõ push notification là optional hay required trong production.
- Nếu required: thêm `FCM_SERVER_KEY` vào strict validation.
- Nếu optional: cần trả trạng thái degraded rõ ràng trong health/admin diagnostics.

### P1 — Notification API có mock fallback khi query DB lỗi

Evidence:
- `apps/api/internal/handler/notification.go`
  - nếu query notifications lỗi hoặc table chưa có, handler rơi xuống `GetMockNotifications()`

Impact:
- Schema drift hoặc migration lỗi có thể bị che khuất bởi dữ liệu giả.
- Admin/UAT dễ hiểu nhầm là notification hoạt động thật.

Việc cần làm:
- Trong production, nếu DB query lỗi thì trả lỗi thay vì mock.
- Chỉ cho phép mock fallback ở local/dev khi `ALLOW_MOCK_SERVICES=true`.

### P1 — AI Quick Suggest vẫn có static fallback

Evidence:
- `apps/api/internal/handler/ai.go`
  - `QuickSuggest()` fallback về curated static suggestions nếu AI không trả dữ liệu parse được

Impact:
- Không nguy hiểm như payment/weather, nhưng nếu bạn quảng bá đây là AI suggestion thì production có thể trả dữ liệu tĩnh mà không lộ rõ trạng thái degraded.

Việc cần làm:
- Quyết định đây là fallback chấp nhận được hay phải surface `source=static` rõ hơn ở UI/admin logs.

## Nhận xét quan trọng

- Sau patch trong lượt này, production compose đã đúng ý hơn:
  - `APP_ENV=production`
  - `APP_STRICT_MODE=true`
  - `ALLOW_MOCK_SERVICES=false`
- Nhưng điều đó chỉ khóa được các service đã thực sự dùng cờ này.
- Weather đã được xử lý theo hướng fail-fast.
- Notification hiện là vùng cần xử lý tiếp rõ nhất nếu mục tiêu là "không trả dữ liệu giả hoặc degraded im lặng trong production".

## Thứ tự nên làm tiếp

1. Chốt policy cho push notification rồi enforce bằng strict validation hoặc degraded health reporting.
2. Tắt mock fallback trong notification handler khi chạy production.
3. Viết smoke test riêng cho push registration và notification query failure path.
4. Chốt hành vi fallback còn lại của AI quick suggest.
