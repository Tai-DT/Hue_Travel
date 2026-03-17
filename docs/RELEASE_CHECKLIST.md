# Huế Travel Release Checklist

Ngày cập nhật: 2026-03-17

Tài liệu này tách rõ 3 lớp:

- `Đã xong`: đã xác minh trực tiếp trong local
- `Cần test thêm`: đã có code/UI/route nhưng chưa đủ bằng chứng để chốt hoàn thiện
- `Phải sửa trước deploy`: còn blocker production hoặc đang dựa vào fallback/mock

## 1. Đã Xong

- `[x]` Infrastructure local chạy ổn: PostgreSQL, Redis, MinIO, Meilisearch
- `[x]` API backend chạy và health ổn
- `[x]` API public smoke pass
- `[x]` Đăng ký tài khoản email/password pass
- `[x]` Đăng nhập email/password pass
- `[x]` Refresh token pass
- `[x]` Logout pass
- `[x]` Booking core pass
- `[x]` Tạo payment local pass trong mock flow
- `[x]` Admin web build pass
- `[x]` Provider portal build pass
- `[x]` Mobile web export pass
- `[x]` Đăng nhập không qua bên thứ ba đã được dọn khỏi mobile/web/provider
- `[x]` Weather production path đã fail-fast, không còn silent mock
- `[x]` Push config production đã fail-fast qua `FCM_SERVER_KEY` strict validation
- `[x]` Notification handler production không còn mock fallback khi `ALLOW_MOCK_SERVICES=false`
- `[x]` AI Quick Suggest production path đã fail-fast, không còn static fallback khi `ALLOW_MOCK_SERVICES=false`
- `[x]` Search production path đã dùng Meilisearch thật cho `search/suggest/trending/stats` và sync experiences từ DB lúc startup
- `[x]` Upload production path không còn mock khi `ALLOW_MOCK_SERVICES=false`, local upload MinIO đã pass
- `[x]` Places / maps production path đã fail-fast khi strict mode tắt fallback; local upstream calls cho search/nearby/directions đã pass

## 2. Cần Test Thêm

### Traveler

- `[ ]` Hồ sơ người dùng: xem, sửa profile, xoá tài khoản
- `[ ]` Trải nghiệm: list, detail, search, filter
- `[ ]` Reviews và favorites
- `[ ]` Chat traveler với guide
- `[ ]` Notifications trong app
- `[ ]` Upload avatar và file
- `[ ]` Social: bạn bè, chuyến đi, reactions
- `[ ]` Feed / stories
- `[ ]` Blog, diary, events
- `[ ]` SOS / emergency
- `[ ]` Translation / phrasebook
- `[ ]` Promotions / coupons
- `[ ]` Gamification / check-in / achievements
- `[ ]` Collections

### Guide

- `[ ]` Đăng nhập guide end-to-end
- `[ ]` Guide profile
- `[ ]` Direct booking từ profile guide
- `[ ]` My tours: create, update, delete experience
- `[ ]` Bookings: confirm, complete
- `[ ]` Calendar
- `[ ]` Revenue

### Admin

- `[ ]` Đăng nhập admin end-to-end
- `[ ]` Dashboard và analytics
- `[ ]` User management
- `[ ]` Booking management
- `[ ]` Experience management
- `[ ]` Reviews management
- `[ ]` Guide applications
- `[ ]` Moderation / support / reports
- `[ ]` Settings / đổi mật khẩu

### Realtime / Multi-role

- `[ ]` Chat realtime qua WebSocket
- `[ ]` Calls flow
- `[ ]` Notification read/unread đồng bộ
- `[ ]` Luồng traveler -> guide -> admin xuyên vai trò

## 3. Phải Sửa Trước Deploy

### P0

- `[x]` Weather: đã bỏ silent mock trong production
  - File liên quan: `apps/api/internal/service/weather.go`
  - Đã thêm strict validation cho `OPENWEATHER_API_KEY`

- `[x]` Push notification: đã chốt theo hướng required trong strict mode
  - File liên quan: `apps/api/internal/service/notification.go`
  - `FCM_SERVER_KEY` hiện là required trong strict mode

- `[ ]` VNPay production: thay mock payment bằng credentials thật, callback URL thật và test callback thật
  - File liên quan: `apps/api/internal/service/vnpay.go`

### P1

- `[x]` Notification API: đã bỏ mock fallback khi DB query lỗi trong production path
  - File liên quan: `apps/api/internal/handler/notification.go`

- `[x]` AI Quick Suggest: production chỉ fallback static khi `ALLOW_MOCK_SERVICES=true`
  - File liên quan: `apps/api/internal/handler/ai.go`

- `[x]` Search: production không còn dùng fallback in-memory cho `search/suggest/trending/stats`
  - File liên quan: `apps/api/internal/service/search.go`

- `[x]` Upload: production không còn mock path và local MinIO upload đã xác nhận hoạt động
  - File liên quan: `apps/api/internal/service/file_upload.go`

- `[x]` Places / maps: local upstream calls đã pass và production path không còn fallback dev khi strict mode bật
  - File liên quan: `apps/api/internal/service/goong_places.go`
  - File liên quan: `apps/api/internal/service/google_places.go`

- `[ ]` AI trip planner / AI chat: xác nhận Gemini key thật và test degraded behavior với upstream thật
  - File liên quan: `apps/api/internal/service/ai_trip_planner.go`

## 4. Thứ Tự Làm Nên Ưu Tiên

1. Khoá production path:
   - VNPay thật

2. Viết smoke/UAT theo vai trò:
   - traveler
   - guide
   - admin

3. Viết smoke/UAT cho nhóm realtime và social:
   - chat
   - calls
   - friends
   - trips
   - feed

4. Chạy một vòng release candidate hoàn chỉnh:
   - local
   - staging
   - production-like env với secret thật

## 5. Tiêu Chí Để Gọi Là “Hoàn Thiện”

Chỉ nên coi dự án là “hoàn thiện” khi đồng thời đạt đủ:

- `[ ]` Không còn blocker production trong mục 3
- `[ ]` Các mục quan trọng trong mục 2 đã được test end-to-end
- `[ ]` Traveler flow hoàn chỉnh pass
- `[ ]` Guide flow hoàn chỉnh pass
- `[ ]` Admin flow hoàn chỉnh pass
- `[ ]` Repo và env release rõ ràng, không còn nhầm lẫn mock/dev path

## 6. Kết Luận Hiện Tại

- Hiện trạng tốt nhất để mô tả là:
  - `core local working`
  - `many features present`
  - `not fully completed for release yet`

- Nếu cần chốt câu trả lời rất ngắn:
  - `Đã xong phần lõi`
  - `Chưa xong toàn bộ`
  - `Chưa nên deploy production ngay`
