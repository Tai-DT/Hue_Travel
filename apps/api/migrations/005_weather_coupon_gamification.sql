-- ============================================
-- Huế Travel — Weather, Coupon, Gamification
-- ============================================

-- ============================================
-- Promotions / Coupons (Mã giảm giá)
-- ============================================
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'percent'
        CHECK (discount_type IN ('percent', 'fixed')),
    discount_value BIGINT NOT NULL, -- % hoặc VND
    min_order BIGINT NOT NULL DEFAULT 0,
    max_discount BIGINT, -- giới hạn giảm tối đa (cho percent)
    usage_limit INTEGER NOT NULL DEFAULT 100,
    used_count INTEGER NOT NULL DEFAULT 0,
    per_user_limit INTEGER NOT NULL DEFAULT 1,
    experience_id UUID REFERENCES experiences(id), -- NULL = áp dụng tất cả
    creator_id UUID REFERENCES users(id),
    is_flash_sale BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promo_active ON promotions(is_active, starts_at, expires_at);

-- Promotion Usage (tracking user usage)
CREATE TABLE IF NOT EXISTS promotion_usages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    promotion_id UUID NOT NULL REFERENCES promotions(id),
    user_id UUID NOT NULL REFERENCES users(id),
    booking_id UUID REFERENCES bookings(id),
    discount_amount BIGINT NOT NULL,
    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(promotion_id, user_id, booking_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_usage_user ON promotion_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_usage_promo ON promotion_usages(promotion_id);

-- ============================================
-- Achievements / Badges (Gamification)
-- ============================================
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(10) NOT NULL DEFAULT '🏆',
    category VARCHAR(30) NOT NULL DEFAULT 'general'
        CHECK (category IN ('general', 'explorer', 'social', 'foodie', 'reviewer', 'guide')),
    xp_reward INTEGER NOT NULL DEFAULT 50,
    requirement_type VARCHAR(30) NOT NULL,
    requirement_count INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Achievements (đã đạt)
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id),
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_ach_user ON user_achievements(user_id);

-- Check-ins (điểm danh địa điểm)
CREATE TABLE IF NOT EXISTS checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_name VARCHAR(255) NOT NULL,
    lat DECIMAL(10,7) NOT NULL,
    lng DECIMAL(10,7) NOT NULL,
    photo_url TEXT,
    note TEXT,
    xp_earned INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkin_user ON checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_date ON checkins(created_at DESC);

-- ============================================
-- Seed: Default Achievements
-- ============================================
INSERT INTO achievements (slug, title, description, icon, category, xp_reward, requirement_type, requirement_count) VALUES
('first_booking',    'Chuyến đầu tiên',     'Hoàn thành booking đầu tiên',         '🎒', 'general',  100, 'bookings_completed', 1),
('explorer_5',       'Nhà thám hiểm',       'Đặt 5 trải nghiệm khác nhau',        '🧭', 'explorer', 200, 'bookings_completed', 5),
('explorer_10',      'Lữ khách Huế',        'Đặt 10 trải nghiệm',                 '🗺️', 'explorer', 500, 'bookings_completed', 10),
('first_review',     'Nhà phê bình',        'Viết đánh giá đầu tiên',              '✍️', 'reviewer', 50,  'reviews_written', 1),
('reviewer_5',       'Reviewer chuyên nghiệp','Viết 5 đánh giá',                   '⭐', 'reviewer', 200, 'reviews_written', 5),
('social_butterfly', 'Bướm xã hội',         'Có 10 bạn bè',                        '🦋', 'social',   150, 'friends_count', 10),
('trip_creator',     'Người dẫn đường',      'Tạo chuyến đi đầu tiên',             '🚀', 'social',   100, 'trips_created', 1),
('foodie',           'Sành ăn Huế',         'Book 3 food tour',                     '🍜', 'foodie',   200, 'food_tours', 3),
('checkin_5',        'Thợ check-in',        'Check-in 5 địa điểm',                 '📍', 'explorer', 100, 'checkins', 5),
('checkin_20',       'Selfie Master',       'Check-in 20 địa điểm',                '📸', 'explorer', 300, 'checkins', 20),
('first_trip_plan',  'Kiến trúc sư hành trình','Dùng AI lập kế hoạch đầu tiên',    '🤖', 'general',  50,  'ai_plans', 1),
('level_5',          'Lên level 5',         'Đạt level 5',                          '🔥', 'general',  100, 'level_reached', 5)
ON CONFLICT (slug) DO NOTHING;

-- Triggers
CREATE TRIGGER set_promotions_updated_at BEFORE UPDATE ON promotions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
