-- ============================================
-- Huế Travel Database Schema
-- Version: 2.0 — Full schema with chat + reviews
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- Users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'traveler'
        CHECK (role IN ('traveler', 'guide', 'blogger', 'merchant', 'expert', 'admin')),
    bio TEXT,
    languages TEXT[] DEFAULT '{}',
    xp INTEGER NOT NULL DEFAULT 0,
    level VARCHAR(20) NOT NULL DEFAULT 'Khách mới',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- OTP Verification
-- ============================================
CREATE TABLE IF NOT EXISTS otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_phone ON otp_verifications(phone, verified);

-- ============================================
-- Guide Profiles
-- ============================================
CREATE TABLE IF NOT EXISTS guide_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    badge_level VARCHAR(20) NOT NULL DEFAULT 'bronze'
        CHECK (badge_level IN ('bronze', 'silver', 'gold', 'platinum')),
    specialties TEXT[] DEFAULT '{}',
    experience_years INTEGER NOT NULL DEFAULT 0,
    total_tours INTEGER NOT NULL DEFAULT 0,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0.00,
    response_time_mins INTEGER NOT NULL DEFAULT 60,
    acceptance_rate NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guide_user ON guide_profiles(user_id);
CREATE INDEX idx_guide_rating ON guide_profiles(avg_rating DESC);

-- ============================================
-- Places
-- ============================================
CREATE TABLE IF NOT EXISTS places (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    description TEXT,
    category VARCHAR(30) NOT NULL
        CHECK (category IN ('stay', 'food', 'experience', 'tour', 'sightseeing', 'transport')),
    address TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    google_place_id VARCHAR(255),
    phone VARCHAR(20),
    website TEXT,
    price_range VARCHAR(10),
    rating NUMERIC(3,2) NOT NULL DEFAULT 0.00,
    rating_count INTEGER NOT NULL DEFAULT 0,
    opening_hours TEXT,
    image_urls TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_places_category ON places(category);
CREATE INDEX idx_places_location ON places USING gist (
    point(lng, lat)
);
CREATE INDEX idx_places_name_trgm ON places USING gin (name gin_trgm_ops);

-- ============================================
-- Experiences
-- ============================================
CREATE TABLE IF NOT EXISTS experiences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guide_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(30) NOT NULL
        CHECK (category IN ('stay', 'food', 'experience', 'tour', 'sightseeing', 'transport')),
    price BIGINT NOT NULL, -- VND
    max_guests INTEGER NOT NULL DEFAULT 10,
    duration_mins INTEGER NOT NULL DEFAULT 120,
    meeting_point TEXT NOT NULL,
    meeting_lat DOUBLE PRECISION NOT NULL DEFAULT 16.4637,
    meeting_lng DOUBLE PRECISION NOT NULL DEFAULT 107.5909,
    includes TEXT[] DEFAULT '{}',
    highlights TEXT[] DEFAULT '{}',
    image_urls TEXT[] DEFAULT '{}',
    rating NUMERIC(3,2) NOT NULL DEFAULT 0.00,
    rating_count INTEGER NOT NULL DEFAULT 0,
    is_instant BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exp_guide ON experiences(guide_id);
CREATE INDEX idx_exp_category ON experiences(category);
CREATE INDEX idx_exp_rating ON experiences(rating DESC);
CREATE INDEX idx_exp_price ON experiences(price);

-- ============================================
-- Bookings
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    traveler_id UUID NOT NULL REFERENCES users(id),
    experience_id UUID NOT NULL REFERENCES experiences(id),
    guide_id UUID NOT NULL REFERENCES users(id),
    booking_date DATE NOT NULL,
    start_time VARCHAR(5) NOT NULL, -- "19:00"
    guest_count INTEGER NOT NULL DEFAULT 1,
    total_price BIGINT NOT NULL,
    service_fee BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'refunded')),
    special_notes TEXT,
    cancel_reason TEXT,
    payment_method VARCHAR(20),
    payment_ref VARCHAR(255),
    paid_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_booking_traveler ON bookings(traveler_id);
CREATE INDEX idx_booking_guide ON bookings(guide_id);
CREATE INDEX idx_booking_status ON bookings(status);
CREATE INDEX idx_booking_date ON bookings(booking_date);

-- ============================================
-- Reviews
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id),
    traveler_id UUID NOT NULL REFERENCES users(id),
    experience_id UUID NOT NULL REFERENCES experiences(id),
    overall_rating NUMERIC(3,2) NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    guide_rating NUMERIC(3,2) NOT NULL CHECK (guide_rating >= 1 AND guide_rating <= 5),
    value_rating NUMERIC(3,2) NOT NULL CHECK (value_rating >= 1 AND value_rating <= 5),
    comment TEXT,
    photo_urls TEXT[] DEFAULT '{}',
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_exp ON reviews(experience_id);
CREATE INDEX idx_review_traveler ON reviews(traveler_id);
CREATE INDEX idx_review_rating ON reviews(overall_rating DESC);

-- ============================================
-- Favorites
-- ============================================
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, experience_id)
);

CREATE INDEX idx_fav_user ON favorites(user_id);

-- ============================================
-- Chat Rooms
-- ============================================
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id),
    participants UUID[] NOT NULL,
    room_type VARCHAR(20) NOT NULL DEFAULT 'direct'
        CHECK (room_type IN ('direct', 'booking', 'group', 'support')),
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_room_participants ON chat_rooms USING gin (participants);

-- ============================================
-- Chat Messages
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text'
        CHECK (message_type IN ('text', 'image', 'location', 'booking', 'system')),
    metadata JSONB,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_msg_room ON chat_messages(room_id, created_at DESC);
CREATE INDEX idx_chat_msg_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_msg_unread ON chat_messages(room_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- Triggers: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_places_updated_at BEFORE UPDATE ON places
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_experiences_updated_at BEFORE UPDATE ON experiences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_chat_rooms_updated_at BEFORE UPDATE ON chat_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
