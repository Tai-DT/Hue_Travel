-- ============================================
-- Huế Travel — Demo Seed Data
-- Idempotent seed for local/dev environments
-- ============================================

INSERT INTO users (phone, email, full_name, role, is_verified, is_active, referral_code, xp, level, password_hash)
VALUES
    ('901111222', 'admin@huetravel.local', 'Hue Travel Admin', 'admin', TRUE, TRUE, 'ADMIN901', 500, 'Admin', '$2y$10$ZYHSdrIkmkz64nDIAJSHlu7NyhsC41eqVaxd4ViSmOWRO835nx4Ga'),
    ('0905556666', 'traveler.mobile@huetravel.local', 'Traveler Demo Huế', 'traveler', TRUE, TRUE, 'TRAV555', 120, 'Explorer', '$2y$10$ZYHSdrIkmkz64nDIAJSHlu7NyhsC41eqVaxd4ViSmOWRO835nx4Ga'),
    ('0907778888', 'guide.demo@huetravel.local', 'Guide Demo Huế', 'guide', TRUE, TRUE, 'GUIDE777', 320, 'Expert', '$2y$10$ZYHSdrIkmkz64nDIAJSHlu7NyhsC41eqVaxd4ViSmOWRO835nx4Ga')
ON CONFLICT (phone) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_verified = EXCLUDED.is_verified,
    is_active = EXCLUDED.is_active,
    xp = EXCLUDED.xp,
    level = EXCLUDED.level,
    password_hash = EXCLUDED.password_hash,
    updated_at = NOW();

INSERT INTO guide_profiles (
    user_id, badge_level, specialties, experience_years, total_tours,
    total_reviews, avg_rating, response_time_mins, acceptance_rate, is_approved, is_available, verified_at
)
SELECT
    u.id,
    'gold',
    ARRAY['food', 'culture', 'history'],
    5,
    42,
    18,
    4.9,
    10,
    98.5,
    TRUE,
    TRUE,
    NOW()
FROM users u
WHERE u.phone = '0907778888'
ON CONFLICT (user_id) DO UPDATE SET
    badge_level = EXCLUDED.badge_level,
    specialties = EXCLUDED.specialties,
    experience_years = EXCLUDED.experience_years,
    total_tours = EXCLUDED.total_tours,
    total_reviews = EXCLUDED.total_reviews,
    avg_rating = EXCLUDED.avg_rating,
    response_time_mins = EXCLUDED.response_time_mins,
    acceptance_rate = EXCLUDED.acceptance_rate,
    is_approved = EXCLUDED.is_approved,
    is_available = EXCLUDED.is_available,
    verified_at = EXCLUDED.verified_at,
    updated_at = NOW();

INSERT INTO experiences (
    guide_id, title, slug, description, category, price, max_guests, duration_mins,
    meeting_point, meeting_lat, meeting_lng, includes, highlights, image_urls, rating,
    rating_count, is_instant, is_active, published_at
)
SELECT
    u.id,
    'Food Tour Test Huế',
    'food-tour-test-hue',
    'Khám phá ẩm thực Huế với hành trình thử bún bò, cơm hến và các món ăn đường phố cùng hướng dẫn viên bản địa.',
    'tour',
    350000,
    8,
    180,
    '16 Lê Lợi, TP Huế',
    16.4637000,
    107.5909000,
    ARRAY['Nước suối', 'Hướng dẫn viên', '3 món ăn đặc sản'],
    ARRAY['Bún bò Huế', 'Cơm hến', 'Chợ Đông Ba'],
    ARRAY['https://images.unsplash.com/photo-1504674900247-0877df9cc836'],
    4.8,
    24,
    TRUE,
    TRUE,
    NOW()
FROM users u
WHERE u.phone = '0907778888'
ON CONFLICT (slug) DO UPDATE SET
    guide_id = EXCLUDED.guide_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    price = EXCLUDED.price,
    max_guests = EXCLUDED.max_guests,
    duration_mins = EXCLUDED.duration_mins,
    meeting_point = EXCLUDED.meeting_point,
    meeting_lat = EXCLUDED.meeting_lat,
    meeting_lng = EXCLUDED.meeting_lng,
    includes = EXCLUDED.includes,
    highlights = EXCLUDED.highlights,
    image_urls = EXCLUDED.image_urls,
    rating = EXCLUDED.rating,
    rating_count = EXCLUDED.rating_count,
    is_instant = EXCLUDED.is_instant,
    is_active = EXCLUDED.is_active,
    published_at = EXCLUDED.published_at,
    updated_at = NOW();
