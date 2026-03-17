# Huế Travel Feature Completion Matrix

Ngày cập nhật: 2026-03-17

## Legend

- `Verified`: đã được xác minh trực tiếp trong lượt kiểm tra hôm nay bằng test, build, smoke script hoặc chạy app local
- `Present`: đã có route/code/UI rõ ràng trong repo, nhưng chưa có smoke/UAT sâu trong lượt này
- `Blocked`: chưa nên coi là hoàn tất production vì còn fallback/mock hoặc phụ thuộc cấu hình ngoài chưa chốt

## Verification Baseline Hôm Nay

Đã chạy lại trực tiếp:

- `go test ./...` trong `apps/api`
- `npm run build` trong `apps/web`
- `npm run build` trong `apps/provider-portal`
- `npx expo export --platform web` trong `apps/mobile`
- `./scripts/smoke-api.sh`
- `./scripts/smoke-auth.sh`
- `./scripts/smoke-booking.sh`
- Kiểm tra runtime local:
  - API: `http://localhost:8080`
  - Admin: `http://localhost:3000`
  - Provider: `http://localhost:3001`
  - Mobile web: `http://localhost:8081`

## Completion Matrix

| Nhóm chức năng | Local hôm nay | Production | Bằng chứng chính | Ghi chú |
|---|---|---|---|---|
| Infrastructure: PostgreSQL, Redis, MinIO, Meilisearch | Verified | Partial | `docker compose ps` healthy | Local ổn; production còn phụ thuộc env/deploy |
| API health và public endpoints | Verified | Partial | `GET /health`, `./scripts/smoke-api.sh` pass | Public API base đang phản hồi tốt |
| Đăng nhập nội bộ email/password | Verified | Partial | `./scripts/smoke-auth.sh` pass | Third-party auth cho login đã được dọn khỏi mobile/web/provider |
| Session, refresh token, logout | Verified | Partial | `./scripts/smoke-auth.sh` pass | Cần thêm UAT đa thiết bị nếu muốn chốt production |
| Hồ sơ người dùng, cập nhật profile, xoá tài khoản | Present | Partial | Route `/me`, mobile/profile/settings tồn tại | Chưa có smoke riêng trong lượt này |
| Trải nghiệm: list, detail, search alias, CRUD guide/admin | Present | Partial | Route `/experiences`, mobile `HomeScreen` và `ExperienceDetailScreen` | Có code rõ; chưa test sâu create/update/delete hôm nay |
| Booking traveler | Verified | Partial | `./scripts/smoke-booking.sh` pass | Luồng core tạo booking hoạt động local |
| Payment VNPay / payment create | Verified | Blocked | `./scripts/smoke-booking.sh` pass trong mock payment | Local pass nhờ mock path; production cần credentials thật |
| Reviews và favorites | Present | Partial | Route `/reviews`, `/favorites`; màn detail/profile tồn tại | Chưa có smoke/UAT riêng |
| Guide profile và direct booking | Present | Partial | Route `/guides`, mobile detail/profile | Chưa test role guide end-to-end hôm nay |
| Chat room, messages, read, WebSocket | Present | Partial | Route `/chat`, `/ws`; mobile `ChatScreen` | Chưa có smoke realtime riêng |
| Search, suggest, trending | Verified | Partial | Route `/search`, local API trả dữ liệu thật từ Meilisearch | Production path đã dùng Meilisearch thật và sync experiences từ DB lúc startup; vẫn cần UAT relevance/ranking |
| Notifications và register device | Present | Partial | Route `/notifications`, mobile `NotificationScreen` | Production đã fail-fast; vẫn cần UAT với FCM thật và DB/device tokens thật |
| Upload file/avatar | Verified | Partial | Route `/upload`, local upload MinIO đã pass | Production path không còn mock khi strict mode tắt fallback; vẫn cần UAT theo UI traveller/guide |
| AI trip planner, AI chat, quick suggest | Present | Partial | Route `/ai`, mobile `AIGuideScreen` | Production path đã fail-fast; vẫn cần `GEMINI_API_KEY` thật và UAT upstream |
| Maps, nearby places, directions | Verified | Partial | Route `/places`, local API trả dữ liệu thật từ upstream | Production path đã fail-fast khi thiếu key/upstream lỗi; vẫn cần UAT mobile map flow |
| Social: friends, trips, reactions, calls | Present | Partial | Route đã đăng ký trong API | Chưa có smoke/UAT riêng cho các flow xã hội |
| Feed / stories | Present | Partial | Route `/feed`, mobile `SocialScreen` | Có code + UI; chưa test sâu |
| Blog, diary, events | Present | Partial | Route `/blog`, `/diary`, `/events`; mobile `MoreScreen` | Có API và UI entry point |
| SOS / emergency | Present | Partial | Route `/emergency`, mobile `MoreScreen` | Cần test hành vi thực tế và quyền vị trí |
| Weather | Present | Partial | Route `/weather`, mobile `MoreScreen` | Code production đã fail-fast; vẫn cần `OPENWEATHER_API_KEY` thật và UAT với upstream |
| Translation / phrasebook | Present | Partial | Route `/translate`, `/phrasebook`; mobile `MoreScreen` | Có code rõ, chưa UAT |
| Promotions, coupons | Present | Partial | Route `/promotions`, mobile `MoreScreen` | Chưa có smoke riêng |
| Gamification: achievements, leaderboard, check-in | Present | Partial | Route `/gamification`, mobile `MoreScreen` | Có API và UI entry point |
| Collections | Present | Partial | Route `/collections`, mobile `MoreScreen` | Chưa có smoke riêng |
| Admin web login và dashboard shell | Verified | Partial | `npm run build` pass, app chạy tại `:3000` | Build ổn; cần UAT từng màn quản trị |
| Admin users / bookings / experiences / reviews / guide apps / moderation / support / reports / settings | Present | Partial | Các page tồn tại trong `apps/web/src/app/` | Chưa có smoke admin role end-to-end |
| Provider portal login và app shell | Verified | Partial | `npm run build` pass, app chạy tại `:3001` | Build ổn; auth dùng email/password |
| Provider my tours / bookings / calendar / revenue / profile | Present | Partial | Các page tồn tại trong `apps/provider-portal/src/app/` | Chưa có UAT guide end-to-end |
| Mobile app shell và điều hướng chính | Verified | Partial | `npx expo export --platform web` pass, app chạy tại `:8081` | App shell ổn sau khi dọn third-party auth |

## Kết Luận Ngắn

- Phần cốt lõi đã xác minh được trong local:
  - infra
  - API health/public
  - auth email/password
  - refresh/logout
  - booking core
  - mobile/web/provider build runtime
- Phần lớn chức năng còn lại đã có code thật và điểm vào UI/API, nhưng hiện mới ở mức `Present`, chưa đủ bằng chứng để gọi là “hoàn thiện xong”.
- Các nhóm đang bị chặn cho production chủ yếu là:
  - payment
  - phần integration ngoài của AI

## Nên Làm Tiếp

1. Viết smoke/UAT cho các nhóm `Present` có rủi ro cao:
   - chat/calls
   - social/friends/trips/feed
   - admin role
   - provider role

2. Xử lý blocker production:
   - VNPay thật
   - AI upstream key + UAT

3. Chốt release checklist theo vai trò:
   - traveler
   - guide
   - admin
