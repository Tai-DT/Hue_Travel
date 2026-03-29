# Huế Travel Feature Status

Ngày cập nhật: 2026-03-17

## Cách đọc

- `[x]` Đã xác minh chạy local trong lần kiểm tra này
- `[~]` Đã có code và build pass, nhưng chưa re-test end-to-end sâu trong lần này
- `[!]` Chưa đạt mức production vì còn fallback/mock hoặc phụ thuộc cấu hình ngoài

## Đã xác minh local

- `[x]` Infrastructure local hoạt động: PostgreSQL, Redis, MinIO, Meilisearch đều healthy qua `docker compose ps`
- `[x]` API backend build/test ổn: `go test ./...` pass trong `apps/api`
- `[x]` Admin web build ổn: `npm run build` pass trong `apps/web`
- `[x]` Provider portal build ổn: `npm run build` pass trong `apps/provider-portal`
- `[x]` Mobile web export ổn: `npx expo export --platform web` pass trong `apps/mobile`
- `[x]` Health endpoint hoạt động: `GET /health` trả về healthy
- `[x]` Auth flow cốt lõi hoạt động: register, login, refresh, logout qua `./scripts/smoke-auth.sh`
- `[x]` Booking flow cốt lõi hoạt động: login, chọn experience, tạo booking, tạo payment, logout qua `./scripts/smoke-booking.sh`

## Backend API

- `[x]` Auth email/password: register, login, refresh, logout, đổi mật khẩu
- `[~]` User profile: `/me`, cập nhật profile, xoá tài khoản
- `[~]` Experiences: list, detail, create, update, delete
- `[~]` Bookings: create, list, detail, cancel, confirm, complete, guide bookings
- `[~]` Reviews và favorites
- `[~]` Guides: top guides, profile, direct booking, update profile
- `[~]` Chat, room messages, mark read
- `[~]` Search, suggest, trending, stats
- `[~]` Notifications và register device
- `[~]` Friends, trips, reactions, calls
- `[~]` Weather, promotions, gamification
- `[~]` Blog, diary, events, emergency
- `[~]` Report/block, guide apply, feed/stories, translate, collections
- `[~]` Admin routes: dashboard, quick stats, users, experiences, bookings, reviews, guide applications, reports

Nguồn đối chiếu chính: `apps/api/internal/app/routes.go`

## Mobile App

- `[x]` App shell build/export được
- `[x]` Auth local email/password đã là flow chính
- `[~]` Home, experience detail, direct guide booking
- `[~]` Booking, payment, booking history
- `[~]` Chat, notifications, profile, settings
- `[~]` Social feed, AI guide
- `[~]` More section có các nhóm: gamification, weather, SOS, promotions, blog, diary, map, translate, collections
- `[~]` Deep linking, offline cache, push hooks đã có trong app shell

Nguồn đối chiếu chính:
- `apps/mobile/App.tsx`
- `apps/mobile/src/screens/`
- `apps/mobile/src/services/api.ts`

## Admin Web

- `[x]` App build pass
- `[~]` Login bằng email/password cho admin
- `[~]` Dashboard, analytics, reports
- `[~]` Users, bookings, experiences, reviews
- `[~]` Guide applications, support, moderation
- `[~]` Settings và đổi mật khẩu

Nguồn đối chiếu chính:
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/`
- `apps/web/src/lib/api.ts`

## Provider Portal

- `[x]` App build pass
- `[~]` Login bằng email/password cho guide
- `[~]` Dashboard guide
- `[~]` My tours: create, update, delete experience
- `[~]` Bookings: list, confirm, complete
- `[~]` Calendar, revenue, profile, đổi mật khẩu

Nguồn đối chiếu chính:
- `apps/provider-portal/src/app/page.tsx`
- `apps/provider-portal/src/app/`
- `apps/provider-portal/src/lib/api.ts`

## Chưa thể coi là production-ready

- `[!]` AI trip planner/chat vẫn có mock fallback khi thiếu hoặc lỗi Gemini
  - `apps/api/internal/service/ai_trip_planner.go`
- `[!]` Maps/places vẫn có mock fallback khi thiếu API key
  - `apps/api/internal/service/goong_places.go`
  - `apps/api/internal/service/google_places.go`
- `[!]` Search có fallback sang in-memory + seed mock data
  - `apps/api/internal/service/search.go`
- `[!]` Payment VNPay có mock payment nếu thiếu credentials
  - `apps/api/internal/service/vnpay.go`
- `[!]` Upload file có mock mode nếu object storage không sẵn sàng
  - `apps/api/internal/service/file_upload.go`
- `[!]` Một số admin stats có nhánh trả dữ liệu mock nếu DB không kết nối
  - `apps/api/internal/handler/admin.go`
- `[!]` `.env.example` vẫn để trống nhiều khóa production quan trọng
  - `GOONG_API_KEY`
  - `GEMINI_API_KEY`
  - `VNPAY_TMN_CODE`
  - `VNPAY_HASH_SECRET`
  - `FCM_SERVER_KEY`
  - `OPENWEATHER_API_KEY`

## Kết luận hiện tại

- Dự án đã vượt mức demo sơ khai.
- Các luồng cốt lõi của sản phẩm đã có thật và đang chạy local.
- Tuy nhiên chưa nên kết luận là "hoàn thiện xong toàn bộ" hoặc "sẵn sàng production" vì vẫn còn một lớp fallback/mock cho nhiều dịch vụ ngoài.
- Nhiều chức năng ngoài auth và booking mới chỉ được xác nhận ở mức code tồn tại + build pass, chưa có smoke/UAT riêng trong lần kiểm tra này.

## Ưu tiên nên làm tiếp

1. Khoá chế độ production:
   bật strict mode trên môi trường staging và điền đủ secrets thật cho AI, maps, payment, upload, weather, push.

2. Viết smoke/UAT theo nhóm chức năng:
   social, trips, chat, admin moderation/support, provider my-tours/revenue/calendar.

3. Chốt tiêu chí release:
   repo sạch, env production rõ ràng, test checklist rõ ràng, và một vòng UAT đa vai trò: traveler, guide, admin.
