# 🏯 Huế Travel API Documentation

**Base URL:** `http://localhost:8080/api/v1`  
**Version:** 1.0.0  
**Auth:** Bearer JWT Token  

---

## 📋 Table of Contents

1. [Health Check](#health-check)
2. [Authentication](#authentication)
3. [User Profile](#user-profile)
4. [Experiences](#experiences)
5. [Bookings](#bookings)
6. [Reviews](#reviews)
7. [Favorites](#favorites)
8. [Guides](#guides)
9. [Chat](#chat)
10. [AI Trip Planner](#ai-trip-planner)
11. [Places (Google Maps)](#places)
12. [Payment](#payment)
13. [Notifications](#notifications)
14. [File Upload](#file-upload)
15. [Search](#search)
16. [Admin](#admin)

---

## Response Format

All responses follow this format:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "per_page": 20
  }
}
```

Error response:
```json
{
  "success": false,
  "error": {
    "code": "HT-AUTH-001",
    "message": "Mô tả lỗi"
  }
}
```

---

## Health Check

### `GET /health`
Check API health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "hue-travel-api",
    "version": "1.0.0"
  }
}
```

---

## Authentication

### `POST /auth/otp/send`
Send OTP to phone number.

**Body:**
```json
{
  "phone": "0901234567"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "OTP đã được gửi",
    "expires_in": 300
  }
}
```

### `POST /auth/otp/verify`
Verify OTP and get tokens.

**Body:**
```json
{
  "phone": "0901234567",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "user": {
      "id": "uuid",
      "phone": "0901234567",
      "full_name": "Nguyễn Văn A",
      "role": "traveler"
    }
  }
}
```

### `POST /auth/google`
Login with Google ID token.

**Body:**
```json
{
  "id_token": "google-id-token"
}
```

### `POST /auth/refresh` 🔒
Refresh access token.

### `POST /auth/logout` 🔒
Invalidate refresh token.

---

## User Profile

### `GET /me` 🔒
Get current user profile.

### `PUT /me` 🔒
Update profile.

**Body:**
```json
{
  "full_name": "Nguyễn Văn B",
  "bio": "Yêu Huế ❤️",
  "avatar_url": "https://...",
  "languages": ["vi", "en"]
}
```

---

## Experiences

### `GET /experiences`
List all experiences (public).

**Query params:**
- `category` — Filter by category
- `min_price`, `max_price` — Price range
- `search` — Text search
- `sort` — Sort by: `price`, `rating`, `created_at`
- `order` — `asc` or `desc`
- `page`, `per_page` — Pagination

### `GET /experiences/:id`
Get experience detail.

### `POST /experiences` 🔒 (guide/admin)
Create new experience.

**Body:**
```json
{
  "title": "Khám phá Đại Nội",
  "description": "Tour lịch sử...",
  "category": "Di sản",
  "price_per_person": 750000,
  "duration_minutes": 180,
  "max_guests": 10,
  "meeting_point": "Cổng Ngọ Môn",
  "images": ["url1", "url2"],
  "tags": ["UNESCO", "heritage"],
  "is_instant_booking": true
}
```

### `PUT /experiences/:id` 🔒 (owner/admin)
Update experience.

### `DELETE /experiences/:id` 🔒 (owner/admin)
Soft delete experience.

---

## Bookings

### `GET /bookings` 🔒
List my bookings (traveler).

**Query params:** `status`, `page`, `per_page`

### `POST /bookings` 🔒
Create booking.

**Body:**
```json
{
  "experience_id": "uuid",
  "booking_date": "2026-03-15",
  "guest_count": 4,
  "special_request": "Có trẻ em 5 tuổi"
}
```

### `GET /bookings/:id` 🔒
Get booking detail.

### `POST /bookings/:id/cancel` 🔒
Cancel booking.

**Body:**
```json
{
  "reason": "Thay đổi lịch"
}
```

### `POST /bookings/:id/confirm` 🔒 (guide)
Confirm pending booking.

### `POST /bookings/:id/complete` 🔒 (guide)
Mark as completed.

### `GET /bookings/guide/me` 🔒 (guide)
List bookings for the guide.

---

## Reviews

### `GET /experiences/:id/reviews`
List reviews for an experience.

### `POST /reviews` 🔒
Create review.

**Body:**
```json
{
  "experience_id": "uuid",
  "booking_id": "uuid",
  "rating": 5,
  "comment": "Tour tuyệt vời!"
}
```

---

## Favorites

### `POST /favorites/toggle/:id` 🔒
Toggle favorite for an experience.

### `GET /favorites` 🔒
List favorite experiences.

---

## Guides

### `GET /guides/top`
Get top-rated guides.

### `GET /guides/:id`
Get guide profile.

---

## Chat

### `GET /chat/rooms` 🔒
List chat rooms.

### `POST /chat/rooms` 🔒
Get or create chat room.

**Body:**
```json
{
  "other_user_id": "uuid"
}
```

### `GET /chat/rooms/:room_id/messages` 🔒
Get messages in room.

### `POST /chat/rooms/:room_id/messages` 🔒
Send message.

**Body:**
```json
{
  "content": "Xin chào!",
  "type": "text"
}
```

### `POST /chat/rooms/:room_id/read` 🔒
Mark as read.

---

## AI Trip Planner

### `POST /ai/trip-plan`
Generate AI trip plan.

**Body:**
```json
{
  "interests": ["lịch sử", "ẩm thực"],
  "duration_days": 3,
  "budget": "medium",
  "travelers": 2
}
```

### `POST /ai/chat`
Chat with AI guide.

**Body:**
```json
{
  "message": "Nên đi đâu ở Huế?",
  "context": []
}
```

### `GET /ai/suggest`
Quick suggestions.

**Query params:** `category`, `limit`

---

## Places

### `GET /places/search`
Search places (Google Maps).

**Query params:** `query`

### `GET /places/nearby`
Find nearby restaurants.

**Query params:** `lat`, `lng`, `radius`, `type`

### `GET /places/directions`
Get directions.

**Query params:** `origin`, `destination`, `mode`

---

## Payment

### `POST /payment/create` 🔒
Create VNPay payment URL.

**Body:**
```json
{
  "booking_id": "uuid",
  "amount": 750000
}
```

### `GET /payment/callback`
VNPay payment callback.

### `GET /payment/methods`
List payment methods.

---

## Notifications

### `GET /notifications` 🔒
List notifications.

### `GET /notifications/unread` 🔒
Get unread count.

### `POST /notifications/:id/read` 🔒
Mark as read.

### `POST /notifications/device` 🔒
Register device for push notifications.

**Body:**
```json
{
  "device_token": "fcm-token",
  "platform": "ios"
}
```

---

## File Upload

### `POST /upload` 🔒
Upload general file.

**Body:** `multipart/form-data` with `file` field.

### `POST /upload/avatar` 🔒
Upload avatar image.

**Body:** `multipart/form-data` with `file` field.

---

## Search

### `GET /search`
Full-text search.

**Query params:** `q`, `type`, `category`, `limit`, `offset`

### `GET /search/suggest`
Search autocomplete.

**Query params:** `q`, `limit`

### `GET /search/trending`
Get trending searches.

### `GET /search/stats`
Get index stats.

---

## Admin 🔒 (admin role)

### `GET /admin/dashboard`
Dashboard statistics.

### `GET /admin/health`
System health info.

### `GET /admin/quick-stats`
Quick comparison stats.

### `GET /admin/users`
List all users.

**Query params:** `search`, `role`, `page`, `per_page`

### `GET /admin/users/:id`
Get user detail.

### `PUT /admin/users/:id/status`
Ban/unban user.

**Body:**
```json
{
  "is_active": false
}
```

### `PUT /admin/users/:id/role`
Change user role.

**Body:**
```json
{
  "role": "guide"
}
```

### `GET /admin/experiences`
List all experiences.

### `DELETE /admin/experiences/:id`
Delete experience.

### `GET /admin/bookings`
List all bookings.

**Query params:** `status`, `page`, `per_page`

### `PUT /admin/bookings/:id/status`
Update booking status.

**Body:**
```json
{
  "status": "confirmed"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| HT-VAL-001 | Validation error |
| HT-AUTH-001 | Rate limited |
| HT-AUTH-002 | OTP send failed |
| HT-AUTH-003 | OTP expired |
| HT-AUTH-004 | OTP invalid |
| HT-AUTH-005 | Google login failed |
| HT-BOOK-001 | Booking validation error |
| HT-BOOK-002 | Experience not found |
| HT-BOOK-003 | Duplicate booking |
| HT-PAY-001 | Payment create failed |
| HT-UPLOAD-001 | File too large |
| HT-UPLOAD-002 | Invalid file type |

---

## 🔒 Legend
- 🔒 = Requires `Authorization: Bearer <token>` header
- 🔒 (guide) = Requires guide role
- 🔒 (admin) = Requires admin role

---

*Documentation auto-generated from route definitions — Last updated: 2026-03-12*
