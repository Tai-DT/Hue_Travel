-- ============================================
-- Huế Travel — Database Schema
-- PostgreSQL 16 + pgvector
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- ENUM Types
-- ============================================
CREATE TYPE user_role AS ENUM ('traveler', 'guide', 'blogger', 'merchant', 'expert', 'admin');
CREATE TYPE category_type AS ENUM ('stay', 'food', 'experience', 'tour', 'sightseeing', 'transport');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'refunded');
CREATE TYPE payment_method AS ENUM ('vnpay', 'momo', 'zalopay', 'stripe');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ============================================
-- Users
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'traveler',
    bio TEXT,
    languages TEXT[] DEFAULT '{}',
    xp INTEGER NOT NULL DEFAULT 0,
    level VARCHAR(50) NOT NULL DEFAULT 'Newbie',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    referral_code VARCHAR(20) UNIQUE,
    referred_by UUID REFERENCES users(id),
    google_id VARCHAR(255) UNIQUE,
    apple_id VARCHAR(255) UNIQUE,
    facebook_id VARCHAR(255) UNIQUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_referral ON users(referral_code) WHERE referral_code IS NOT NULL;

-- ============================================
-- OTP Verifications
-- ============================================
CREATE TABLE otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_phone ON otp_verifications(phone, verified);

-- ============================================
-- Guide Profiles (extends users)
-- ============================================
CREATE TABLE guide_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    badge_level VARCHAR(20) NOT NULL DEFAULT 'bronze', -- bronze, silver, gold, platinum
    specialties TEXT[] DEFAULT '{}',
    years_experience INTEGER DEFAULT 0,
    response_rate DECIMAL(5,2) DEFAULT 0,
    response_time_mins INTEGER DEFAULT 0,
    total_tours INTEGER DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    payout_bank_name VARCHAR(100),
    payout_bank_account VARCHAR(50),
    payout_bank_holder VARCHAR(255),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Places (quán ăn, địa điểm, khách sạn, ...)
-- ============================================
CREATE TABLE places (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    category category_type NOT NULL,
    address TEXT NOT NULL,
    lat DECIMAL(10,7) NOT NULL,
    lng DECIMAL(10,7) NOT NULL,
    google_place_id VARCHAR(255) UNIQUE,
    osm_id BIGINT UNIQUE,
    phone VARCHAR(20),
    website TEXT,
    price_range VARCHAR(10), -- '$', '$$', '$$$'
    rating DECIMAL(3,2) NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    opening_hours JSONB,
    image_urls TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    embedding vector(384), -- for semantic search
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_places_category ON places(category);
CREATE INDEX idx_places_location ON places USING GIST (
    ST_SetSRID(ST_Point(lng::double precision, lat::double precision), 4326)
);
CREATE INDEX idx_places_slug ON places(slug);
CREATE INDEX idx_places_google ON places(google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX idx_places_tags ON places USING GIN(tags);
CREATE INDEX idx_places_name_trgm ON places USING GIN(name gin_trgm_ops);

-- ============================================
-- Experiences (tour, food tour, workshop,...)
-- ============================================
CREATE TABLE experiences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guide_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    category category_type NOT NULL,
    price BIGINT NOT NULL, -- VND
    max_guests INTEGER NOT NULL DEFAULT 6,
    duration_mins INTEGER NOT NULL DEFAULT 180,
    meeting_point TEXT NOT NULL,
    meeting_lat DECIMAL(10,7) NOT NULL,
    meeting_lng DECIMAL(10,7) NOT NULL,
    includes TEXT[] DEFAULT '{}',
    highlights TEXT[] DEFAULT '{}',
    image_urls TEXT[] DEFAULT '{}',
    rating DECIMAL(3,2) NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    is_instant BOOLEAN NOT NULL DEFAULT FALSE,
    cancel_policy VARCHAR(20) NOT NULL DEFAULT 'flexible', -- flexible, moderate, strict
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exp_guide ON experiences(guide_id);
CREATE INDEX idx_exp_category ON experiences(category);
CREATE INDEX idx_exp_active ON experiences(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_exp_slug ON experiences(slug);
CREATE INDEX idx_exp_rating ON experiences(rating DESC);

-- ============================================
-- Bookings
-- ============================================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_code VARCHAR(20) UNIQUE NOT NULL, -- HT-XXXXXX
    traveler_id UUID NOT NULL REFERENCES users(id),
    experience_id UUID NOT NULL REFERENCES experiences(id),
    guide_id UUID NOT NULL REFERENCES users(id),
    booking_date DATE NOT NULL,
    start_time VARCHAR(5) NOT NULL, -- '19:00'
    guest_count INTEGER NOT NULL DEFAULT 1,
    unit_price BIGINT NOT NULL,
    total_price BIGINT NOT NULL,
    service_fee BIGINT NOT NULL DEFAULT 0, -- 5% platform fee
    discount_amount BIGINT NOT NULL DEFAULT 0,
    promo_code VARCHAR(20),
    status booking_status NOT NULL DEFAULT 'pending',
    special_notes TEXT,
    cancel_reason TEXT,
    payment_method payment_method,
    payment_ref VARCHAR(255),
    paid_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_booking_traveler ON bookings(traveler_id);
CREATE INDEX idx_booking_guide ON bookings(guide_id);
CREATE INDEX idx_booking_exp ON bookings(experience_id);
CREATE INDEX idx_booking_status ON bookings(status);
CREATE INDEX idx_booking_date ON bookings(booking_date);
CREATE INDEX idx_booking_code ON bookings(booking_code);

-- ============================================
-- Reviews
-- ============================================
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id),
    traveler_id UUID NOT NULL REFERENCES users(id),
    experience_id UUID NOT NULL REFERENCES experiences(id),
    guide_id UUID NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    guide_rating INTEGER NOT NULL CHECK (guide_rating BETWEEN 1 AND 5),
    value_rating INTEGER NOT NULL CHECK (value_rating BETWEEN 1 AND 5),
    title VARCHAR(255),
    content TEXT,
    photo_urls TEXT[] DEFAULT '{}',
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    reply TEXT,
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_exp ON reviews(experience_id);
CREATE INDEX idx_review_guide ON reviews(guide_id);
CREATE INDEX idx_review_rating ON reviews(rating DESC);

-- ============================================
-- Chat Messages
-- ============================================
CREATE TABLE chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id),
    traveler_id UUID NOT NULL REFERENCES users(id),
    guide_id UUID NOT NULL REFERENCES users(id),
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(traveler_id, guide_id)
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text', -- text, image, booking_card, system
    metadata JSONB,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_room ON chat_messages(room_id, created_at DESC);
CREATE INDEX idx_chat_sender ON chat_messages(sender_id);

-- ============================================
-- Favorites (wishlist)
-- ============================================
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    experience_id UUID REFERENCES experiences(id) ON DELETE CASCADE,
    place_id UUID REFERENCES places(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (experience_id IS NOT NULL OR place_id IS NOT NULL)
);

CREATE UNIQUE INDEX idx_fav_user_exp ON favorites(user_id, experience_id) WHERE experience_id IS NOT NULL;
CREATE UNIQUE INDEX idx_fav_user_place ON favorites(user_id, place_id) WHERE place_id IS NOT NULL;

-- ============================================
-- Payouts (to guides/merchants)
-- ============================================
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_code VARCHAR(20) UNIQUE NOT NULL, -- PAY-XXXXXX
    guide_id UUID NOT NULL REFERENCES users(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_amount BIGINT NOT NULL,
    platform_fee BIGINT NOT NULL,
    net_amount BIGINT NOT NULL,
    status payout_status NOT NULL DEFAULT 'pending',
    bank_name VARCHAR(100),
    bank_account VARCHAR(50),
    bank_holder VARCHAR(255),
    transaction_ref VARCHAR(255),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payout_guide ON payouts(guide_id);
CREATE INDEX idx_payout_status ON payouts(status);

-- ============================================
-- Trigger: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_places_updated_at BEFORE UPDATE ON places
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_experiences_updated_at BEFORE UPDATE ON experiences
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_guide_profiles_updated_at BEFORE UPDATE ON guide_profiles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================
-- Notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL DEFAULT 'general',
    title       VARCHAR(255) NOT NULL,
    body        TEXT NOT NULL,
    data        JSONB DEFAULT '{}',
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- Device Tokens (FCM/APNs)
-- ============================================
CREATE TABLE IF NOT EXISTS device_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fcm_token   TEXT NOT NULL,
    platform    VARCHAR(20) NOT NULL DEFAULT 'android',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, fcm_token)
);

CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);

-- ============================================
-- Seed: Default admin user
-- ============================================
INSERT INTO users (id, phone, full_name, role, is_verified, is_active)
VALUES (
    uuid_generate_v4(),
    '0901000000',
    'Admin Huế Travel',
    'admin',
    TRUE,
    TRUE
) ON CONFLICT DO NOTHING;
