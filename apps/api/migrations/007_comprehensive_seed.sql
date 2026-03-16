-- ============================================================
-- 007: Comprehensive Seed Data (Fixed for actual schema)
-- ============================================================

-- Create guide users
INSERT INTO users (id, phone, email, full_name, role, bio, avatar_url, is_verified, is_active, xp, level)
VALUES
('a1111111-1111-1111-1111-111111111111', '+84900001111', 'guide.minh@hue.vn',
 'Nguyễn Văn Minh', 'guide',
 'Hướng dẫn viên 10 năm kinh nghiệm, chuyên tour di sản văn hóa Huế',
 'https://randomuser.me/api/portraits/men/32.jpg', true, true, 500, 'Gold'),

('a2222222-2222-2222-2222-222222222222', '+84900002222', 'guide.lan@hue.vn',
 'Trần Thị Lan', 'guide',
 'Hướng dẫn viên ẩm thực Huế, 8 năm kinh nghiệm, nói tiếng Anh & Hàn',
 'https://randomuser.me/api/portraits/women/44.jpg', true, true, 350, 'Silver'),

('a3333333-3333-3333-3333-333333333333', '+84900003333', 'guide.hoa@hue.vn',
 'Lê Hương Hoa', 'guide',
 'Chuyên sinh thái, thiên nhiên Huế, trekking sông Hương',
 'https://randomuser.me/api/portraits/women/68.jpg', true, true, 200, 'Bronze')
ON CONFLICT (phone) DO NOTHING;

-- Guide profiles (matching actual schema)
INSERT INTO guide_profiles (id, user_id, specialties, experience_years, avg_rating, total_reviews, total_tours, is_approved, is_available, badge_level)
VALUES
(uuid_generate_v4(), 'a1111111-1111-1111-1111-111111111111',
 ARRAY['Di sản văn hóa','Kiến trúc cung đình','Lịch sử triều Nguyễn'], 10, 4.9, 156, 420, true, true, 'gold'),

(uuid_generate_v4(), 'a2222222-2222-2222-2222-222222222222',
 ARRAY['Ẩm thực đường phố','Food tour','Nấu ăn cung đình'], 8, 4.8, 98, 280, true, true, 'silver'),

(uuid_generate_v4(), 'a3333333-3333-3333-3333-333333333333',
 ARRAY['Sinh thái','Trekking','Kayak','Đạp xe'], 5, 4.7, 67, 150, true, true, 'bronze')
ON CONFLICT (user_id) DO NOTHING;

-- Experiences (matching actual schema: duration_mins, meeting_lat, meeting_lng, includes, etc.)
INSERT INTO experiences (id, guide_id, title, slug, description, category, duration_mins, price, max_guests, meeting_point, meeting_lat, meeting_lng, image_urls, highlights, includes, is_active, rating, rating_count)
VALUES
(uuid_generate_v4(), 'a1111111-1111-1111-1111-111111111111',
 'Khám phá Đại Nội Huế — Di sản UNESCO', 'kham-pha-dai-noi-hue',
 'Chuyến tham quan Đại Nội Huế kéo dài 3 giờ, bao gồm Ngọ Môn, Điện Thái Hòa, Tử Cấm Thành, và Thế Miếu. Hướng dẫn viên kể về lịch sử 143 năm triều Nguyễn.',
 'heritage', 180, 350000, 8, 'Cổng Ngọ Môn, Đại Nội Huế',
 16.4698, 107.5789,
 ARRAY['https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800','https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800'],
 ARRAY['Ngọ Môn','Điện Thái Hòa','Tử Cấm Thành','Thế Miếu','Hiển Lâm Các'],
 ARRAY['Vé vào cổng','Hướng dẫn viên','Nước uống','Nón lá'],
 true, 4.9, 87),

(uuid_generate_v4(), 'a1111111-1111-1111-1111-111111111111',
 'Tour Lăng Tẩm Hoàng Gia — Khải Định & Tự Đức', 'tour-lang-tam-hoang-gia',
 'Tham quan hai lăng tẩm đẹp nhất Huế: Lăng Khải Định với kiến trúc Đông-Tây, và Lăng Tự Đức thơ mộng bên hồ Lưu Khiêm.',
 'heritage', 240, 500000, 6, 'Lăng Khải Định, Huế',
 16.4107, 107.5798,
 ARRAY['https://images.unsplash.com/photo-1571536802807-30451e3955d8?w=800'],
 ARRAY['Lăng Khải Định','Lăng Tự Đức','Hồ Lưu Khiêm','Kiến trúc cung đình'],
 ARRAY['Vé tham quan','Hướng dẫn viên','Xe đưa đón','Nước uống'],
 true, 4.8, 56),

(uuid_generate_v4(), 'a2222222-2222-2222-2222-222222222222',
 'Food Tour Ẩm Thực Đường Phố Huế', 'food-tour-am-thuc-duong-pho-hue',
 '4 giờ khám phá 8 món ăn đặc sắc nhất Huế: bún bò, cơm hến, bánh bèo, bánh nậm, bánh lọc, chè Huế, nem lụi, bánh ướt.',
 'food', 240, 400000, 6, 'Chợ Đông Ba, Huế',
 16.4697, 107.5927,
 ARRAY['https://images.unsplash.com/photo-1555126634-323283e090fa?w=800','https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800'],
 ARRAY['Bún bò Huế','Cơm hến','Bánh bèo/nậm/lọc','Chè Huế','Nem lụi'],
 ARRAY['8 món ăn','Hướng dẫn viên','Nước uống','Bảo hiểm'],
 true, 4.9, 120),

(uuid_generate_v4(), 'a2222222-2222-2222-2222-222222222222',
 'Workshop Nấu Ăn Cung Đình Huế', 'workshop-nau-an-cung-dinh',
 'Học nấu 3 món ẩm thực cung đình từ đầu bếp chuyên nghiệp. Bao gồm đi chợ, nấu bếp, thưởng thức.',
 'food', 300, 600000, 4, 'Nhà vườn Kim Long, Huế',
 16.4555, 107.5695,
 ARRAY['https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800'],
 ARRAY['Chợ truyền thống','Học nấu ăn','Ẩm thực cung đình','Thưởng thức'],
 ARRAY['Nguyên liệu','Chef hướng dẫn','Tạp dề','Công thức'],
 true, 4.7, 45),

(uuid_generate_v4(), 'a3333333-3333-3333-3333-333333333333',
 'Sunset Kayak Sông Hương', 'sunset-kayak-song-huong',
 'Chèo kayak sông Hương lúc hoàng hôn, ngắm cầu Trường Tiền, Chùa Thiên Mụ trong ánh chiều tà tuyệt đẹp.',
 'adventure', 150, 280000, 8, 'Bến thuyền Tòa Khâm, Huế',
 16.4620, 107.5850,
 ARRAY['https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800','https://images.unsplash.com/photo-1472745433479-4556f22e32c2?w=800'],
 ARRAY['Kayak sông Hương','Hoàng hôn','Cầu Trường Tiền','Chùa Thiên Mụ'],
 ARRAY['Kayak + áo phao','Hướng dẫn viên','Nước uống','Ảnh chụp'],
 true, 4.8, 78),

(uuid_generate_v4(), 'a3333333-3333-3333-3333-333333333333',
 'Trekking Vườn Quốc Gia Bạch Mã', 'trekking-bach-ma',
 'Ngày trekking VQG Bạch Mã — jungle trek, thác Đỗ Quyên, đỉnh 1450m view biển.',
 'adventure', 480, 750000, 6, 'Cổng VQG Bạch Mã',
 16.2020, 107.8543,
 ARRAY['https://images.unsplash.com/photo-1551632811-561732d1e306?w=800'],
 ARRAY['Jungle trekking','Thác Đỗ Quyên','Đỉnh 1450m','View biển'],
 ARRAY['Hướng dẫn viên','Vé vào cổng','Bữa trưa','Nước uống','Bảo hiểm'],
 true, 4.6, 34),

(uuid_generate_v4(), 'a1111111-1111-1111-1111-111111111111',
 'Đêm Nhạc Cung Đình trên Sông Hương', 'dem-nhac-cung-dinh-song-huong',
 'Thưởng thức Nhã nhạc UNESCO trên thuyền Rồng lướt sông Hương. Bao gồm trà cung đình.',
 'culture', 120, 450000, 12, 'Bến Thuyền Rồng, Lê Lợi',
 16.4612, 107.5869,
 ARRAY['https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800'],
 ARRAY['Nhã nhạc UNESCO','Thuyền Rồng','Trà cung đình','Biểu diễn sống'],
 ARRAY['Vé thuyền','Biểu diễn','Trà + bánh','Audio guide'],
 true, 4.9, 92),

(uuid_generate_v4(), 'a2222222-2222-2222-2222-222222222222',
 'Đạp Xe Làng Cổ Phước Tích', 'dap-xe-lang-co-phuoc-tich',
 'Đạp xe 20km khám phá làng cổ 500 tuổi — nhà rường cổ, nghề gốm truyền thống, ẩm thực làng quê.',
 'culture', 300, 350000, 8, 'Làng cổ Phước Tích, Phong Điền',
 16.5800, 107.3400,
 ARRAY['https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800'],
 ARRAY['Làng cổ 500 tuổi','Nhà rường','Nghề gốm','Ẩm thực làng'],
 ARRAY['Xe đạp + mũ','Hướng dẫn viên','Bữa trưa','Nước uống'],
 true, 4.7, 38)
ON CONFLICT DO NOTHING;

-- Blog posts (valid categories: tips, culture, food, history, nature, guide, news, story)
INSERT INTO blog_posts (id, author_id, slug, title, cover_image, content, tags, category, view_count, like_count, is_published)
VALUES
(uuid_generate_v4(), 'a1111111-1111-1111-1111-111111111111',
 'top-10-diem-check-in-dep-nhat-hue-2026',
 'Top 10 Điểm Check-in Đẹp Nhất Huế 2026',
 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800',
 '# Top 10 Điểm Check-in Đẹp Nhất Huế 2026

## 1. Đại Nội
Kinh thành Huế, hoàng hôn tại Ngọ Môn là thời điểm đẹp nhất.

## 2. Cầu Trường Tiền  
Icon của Huế, lung linh nhất vào buổi đêm với đèn LED đổi màu.

## 3. Chùa Thiên Mụ
Ngôi chùa cổ 400 năm bên bờ sông Hương.

## 4. Lăng Khải Định
Kiến trúc Đông-Tây kết hợp, mosaic sảnh tinh xảo.

## 5. Đồi Vọng Cảnh
Ngắm toàn cảnh sông Hương từ trên cao. 

## 6. Phố Đi Bộ Nguyễn Đình Chiểu
Con phố sống động nhất Huế về đêm.

## 7. Chợ Đông Ba
Chợ truyền thống lớn nhất, thiên đường ẩm thực.

## 8. Hồ Tịnh Tâm
Hồ sen giữa lòng thành phố, tháng 6-7.

## 9. Cửa Biển Thuận An
Bãi biển gần Huế nhất, hoàng hôn tuyệt đẹp.

## 10. Nhà Vườn Kim Long
Không gian yên bình, nhà vườn truyền thống.',
 ARRAY['check-in','huế','du lịch'], 'tips', 1250, 87, true),

(uuid_generate_v4(), 'a2222222-2222-2222-2222-222222222222',
 'huong-dan-an-sap-hue-trong-24-gio',
 'Hướng Dẫn Ăn Sập Huế Trong 24 Giờ',
 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=800',
 '# Ăn Sập Huế Trong 24 Giờ 🍜

## Sáng (6:00-8:00)
- **Bún bò Huế** tại quán Bà Tuyết
- **Bánh canh cua** gần chợ An Cựu

## Giữa sáng (9:00-10:00)
- **Bánh bèo, nậm, lọc** tại Huyền Anh
- **Chè Huế** thập cẩm hẻm Hùng Vương

## Trưa (11:30-13:00)
- **Cơm hến** Bà Mai, đường Chi Lăng

## Chiều (14:00-16:00)
- **Nem lụi** cuốn bánh tráng tại chợ Đông Ba

## Tối (18:00-20:00)
- **Ốc Huế** — ốc xào me, ốc nướng mỡ hành

> 💡 Budget: khoảng 300,000-500,000đ cho cả ngày!',
 ARRAY['ẩm thực','bún bò','street food'], 'food', 2340, 156, true),

(uuid_generate_v4(), 'a3333333-3333-3333-3333-333333333333',
 'cam-nang-du-lich-hue-mua-he-2026',
 'Cẩm Nang Du Lịch Huế Mùa Hè 2026',
 'https://images.unsplash.com/photo-1583418855671-88c9c87efcf9?w=800',
 '# Cẩm Nang Du Lịch Huế Mùa Hè 2026 ☀️

## Thời tiết
Mùa hè Huế nóng (32-38°C), ít mưa. Đi sáng sớm hoặc chiều mát.

## Di chuyển
- Sân bay Phú Bài, cách trung tâm 15km
- Grab, xe đạp, xe máy thuê

## Lịch trình 3N2Đ
### Ngày 1: Di sản
Đại Nội → Lăng Khải Định → Thuyền Rồng

### Ngày 2: Ẩm thực
Food tour → Chùa Thiên Mụ → Kayak sông Hương

### Ngày 3: Thiên nhiên
Biển Thuận An → Làng hương Thủy Xuân

## Chi phí ước tính: ~3,600,000đ/người',
 ARRAY['cẩm nang','mùa hè','budget'], 'guide', 890, 42, true)
ON CONFLICT DO NOTHING;

-- Places (matching actual schema: name, name_en, slug, image_urls, tags, etc.)
INSERT INTO places (id, name, name_en, slug, description, category, lat, lng, address, image_urls, tags, rating, rating_count, is_active)
VALUES
(uuid_generate_v4(), 'Đại Nội Huế', 'Hue Imperial Citadel', 'dai-noi-hue',
 'Kinh thành Huế — Di sản văn hóa thế giới UNESCO', 'heritage',
 16.4698, 107.5789, '141 Đặng Trần Côn, Thuận Thành, Huế',
 ARRAY['https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800'], ARRAY['di sản','UNESCO','cung đình'], 4.8, 1256, true),

(uuid_generate_v4(), 'Chùa Thiên Mụ', 'Thien Mu Pagoda', 'chua-thien-mu',
 'Ngôi chùa cổ 400 năm bên sông Hương, tháp Phước Duyên 7 tầng', 'temple',
 16.4539, 107.5532, 'Hà Khê, Kim Long, Huế',
 ARRAY['https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800'], ARRAY['chùa','sông Hương','tháp'], 4.7, 890, true),

(uuid_generate_v4(), 'Lăng Khải Định', 'Khai Dinh Tomb', 'lang-khai-dinh',
 'Lăng tẩm kiến trúc Đông-Tây kết hợp độc đáo', 'heritage',
 16.4107, 107.5798, 'Khải Định, Thủy Bằng, Hương Thủy',
 ARRAY['https://images.unsplash.com/photo-1571536802807-30451e3955d8?w=800'], ARRAY['lăng tẩm','kiến trúc','triều Nguyễn'], 4.9, 678, true),

(uuid_generate_v4(), 'Chợ Đông Ba', 'Dong Ba Market', 'cho-dong-ba',
 'Chợ truyền thống lớn nhất Huế, thiên đường ẩm thực', 'market',
 16.4697, 107.5927, 'Trần Hưng Đạo, Phú Hòa, Huế',
 ARRAY['https://images.unsplash.com/photo-1555126634-323283e090fa?w=800'], ARRAY['chợ','ẩm thực','mua sắm'], 4.5, 543, true),

(uuid_generate_v4(), 'Cầu Trường Tiền', 'Truong Tien Bridge', 'cau-truong-tien',
 'Biểu tượng Huế, 6 nhịp cầu đèn LED đổi màu đẹp lung linh', 'landmark',
 16.4650, 107.5870, 'Trường Tiền, Phú Hội, Huế',
 ARRAY['https://images.unsplash.com/photo-1583418855671-88c9c87efcf9?w=800'], ARRAY['cầu','biểu tượng','đêm'], 4.8, 2100, true),

(uuid_generate_v4(), 'Bún Bò Bà Tuyết', 'Ba Tuyet Bun Bo', 'bun-bo-ba-tuyet',
 'Bún bò Huế nổi tiếng nhất thành phố', 'restaurant',
 16.4645, 107.5875, '47 Phạm Hồng Thái, Phú Hội, Huế',
 ARRAY['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800'], ARRAY['bún bò','ẩm thực','nổi tiếng'], 4.6, 890, true),

(uuid_generate_v4(), 'Đồi Vọng Cảnh', 'Vong Canh Hill', 'doi-vong-canh',
 'Ngắm toàn cảnh sông Hương và thành phố Huế từ trên cao', 'viewpoint',
 16.4380, 107.5670, 'Thủy Biều, Huế',
 ARRAY['https://images.unsplash.com/photo-1472745433479-4556f22e32c2?w=800'], ARRAY['đồi','view','sông Hương'], 4.7, 456, true)
ON CONFLICT DO NOTHING;
