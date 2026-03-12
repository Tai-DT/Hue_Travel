-- ============================================
-- Huế Travel — Seed Data
-- Dữ liệu mẫu thực tế Huế
-- ============================================

-- ---- Users ----
INSERT INTO users (id, phone, email, full_name, role, bio, languages, xp, level, is_verified) VALUES
  ('a1111111-1111-1111-1111-111111111111', '0901234567', 'minh@guide.vn', 'Nguyễn Văn Minh', 'guide', 'Hướng dẫn viên 10 năm kinh nghiệm, chuyên tour ẩm thực Huế', '{vi,en,fr}', 2500, 'Bậc thầy', TRUE),
  ('a2222222-2222-2222-2222-222222222222', '0912345678', 'lan@guide.vn', 'Trần Thị Lan', 'guide', 'Yêu Huế và muốn chia sẻ vẻ đẹp này với du khách', '{vi,en}', 1800, 'Chuyên gia', TRUE),
  ('a3333333-3333-3333-3333-333333333333', '0923456789', 'dung@guide.vn', 'Lê Hoàng Dũng', 'guide', 'Chuyên gia lịch sử triều Nguyễn, tour văn hoá', '{vi,en,ja}', 3200, 'Bậc thầy', TRUE),
  ('b1111111-1111-1111-1111-111111111111', '0934567890', 'traveler1@mail.com', 'Phạm Linh Chi', 'traveler', 'Foodie chính hiệu, yêu di sản', '{vi}', 450, 'Khám phá', FALSE),
  ('b2222222-2222-2222-2222-222222222222', '0945678901', 'traveler2@mail.com', 'Hoàng Minh Tuấn', 'traveler', NULL, '{vi,en}', 120, 'Khách mới', FALSE);

-- ---- Guide Profiles ----
INSERT INTO guide_profiles (user_id, badge_level, specialties, experience_years, total_tours, total_reviews, avg_rating, response_time_mins, acceptance_rate) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'gold', '{ẩm thực,street food,cooking class}', 10, 856, 423, 4.87, 15, 97.5),
  ('a2222222-2222-2222-2222-222222222222', 'silver', '{thiên nhiên,sông Hương,xe đạp}', 5, 312, 178, 4.72, 30, 92.0),
  ('a3333333-3333-3333-3333-333333333333', 'platinum', '{lịch sử,di sản,triều Nguyễn,kiến trúc}', 15, 1245, 687, 4.95, 10, 99.0);

-- ---- Places ----
INSERT INTO places (id, name, name_en, description, category, address, lat, lng, rating, rating_count, tags) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Đại Nội Huế', 'Hue Imperial City', 'Quần thể di tích cung đình triều Nguyễn, Di sản Thế giới UNESCO', 'sightseeing', 'Đường 23/8, Thuận Hoà, TP Huế', 16.4698, 107.5786, 4.7, 1523, '{UNESCO,lịch sử,kiến trúc,triều Nguyễn}'),
  ('c2222222-2222-2222-2222-222222222222', 'Chùa Thiên Mụ', 'Thien Mu Pagoda', 'Ngôi chùa cổ nhất Huế, biểu tượng thành phố', 'sightseeing', 'Kim Long, Huế', 16.4539, 107.5534, 4.6, 987, '{chùa,tâm linh,sông Hương}'),
  ('c3333333-3333-3333-3333-333333333333', 'Lăng Tự Đức', 'Tu Duc Tomb', 'Lăng mộ đẹp nhất trong hệ thống lăng tẩm Huế', 'sightseeing', 'Thủy Xuân, Huế', 16.4582, 107.5619, 4.5, 645, '{lăng tẩm,kiến trúc,vườn}'),
  ('c4444444-4444-4444-4444-444444444444', 'Bún Bò Huế Bà Tuyết', 'Ba Tuyet Bun Bo Hue', 'Quán bún bò nổi tiếng nhất Huế', 'food', '47 Nguyễn Công Trứ, Huế', 16.4637, 107.5909, 4.5, 234, '{bún bò,ẩm thực,street food}'),
  ('c5555555-5555-5555-5555-555555555555', 'Cầu Trường Tiền', 'Truong Tien Bridge', 'Biểu tượng lãng mạn của Huế', 'sightseeing', 'Cầu Trường Tiền, Huế', 16.4694, 107.5893, 4.8, 2134, '{cầu,đêm,sông Hương}');

-- ---- Experiences ----
INSERT INTO experiences (id, guide_id, title, description, category, price, max_guests, duration_mins, meeting_point, meeting_lat, meeting_lng, includes, highlights, rating, rating_count, is_instant) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Khám phá Ẩm thực Hoàng Cung Huế', 'Trải nghiệm ẩm thực cung đình qua 8 món ăn đặc trưng, từ bánh bèo đến chè Huế. Được nấu và thưởng thức tại không gian truyền thống.', 'food', 300000, 8, 180, '15 Lê Lợi, Phú Hội, TP Huế', 16.4637, 107.5909, '{8 món ăn cung đình,nước uống,xe đưa đón,hướng dẫn viên}', '{Học cách nấu bánh bèo hoàng cung,Thưởng thức 8 món authentic,Nghe câu chuyện ẩm thực triều Nguyễn,Nhận công thức nấu ăn}', 4.87, 423, TRUE),
  ('d2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'Chèo thuyền sông Hương hoàng hôn', 'Lênh đênh trên sông Hương vào lúc hoàng hôn, nghe ca Huế, thưởng trà và ngắm cầu Trường Tiền lung linh.', 'experience', 200000, 6, 120, 'Bến thuyền Toà Khâm, Huế', 16.4688, 107.5867, '{thuyền,ca Huế,trà sen,bánh Huế}', '{Hoàng hôn sông Hương,Nghe ca Huế trên thuyền,Trà sen Tịnh Tâm,Chụp ảnh cầu Trường Tiền ban đêm}', 4.72, 178, FALSE),
  ('d3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', 'Tour Đại Nội — Bí mật Tử Cấm Thành', 'Khám phá sâu Đại Nội với guide chuyên lịch sử triều Nguyễn. Những câu chuyện bí mật mà sách không ghi.', 'tour', 350000, 10, 240, 'Cổng Ngọ Môn, Đại Nội Huế', 16.4698, 107.5786, '{vé vào Đại Nội,nước uống,nón lá,tài liệu lịch sử}', '{Câu chuyện bí mật Tử Cấm Thành,Kiến trúc phong thuỷ,Vua Thành Thái và cuộc cách mạng,Ảnh check-in những điểm ít người biết}', 4.95, 687, TRUE),
  ('d4444444-4444-4444-4444-444444444444', 'a1111111-1111-1111-1111-111111111111', 'Street Food tour — Ăn sạch Huế', 'Dạo phố ăn vặt Huế cùng local guide, thử 12+ món từ bún bò đến chè đậu ván.', 'food', 250000, 6, 150, 'Ngã tư Hùng Vương - Nguyễn Huệ', 16.4601, 107.5882, '{12+ món ăn,nước uống,xe máy (nếu cần)}', '{Bún bò gốc Huế,Bánh khoái Lạc Thiện,Chè hẻm bí mật,Nem lụi cổng thành}', 4.83, 312, TRUE);

-- Done!
SELECT 'Seed data inserted successfully!' AS status;
