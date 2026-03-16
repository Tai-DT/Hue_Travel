-- ============================================
-- Huế Travel — Social Features Migration
-- Friends, Trips, Trip Members, Guide Discovery
-- ============================================

-- ============================================
-- Friendships (Kết bạn)
-- ============================================
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requester ON friendships(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_addressee ON friendships(addressee_id, status);

-- ============================================
-- Trips (Chuyến đi chung)
-- ============================================
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    destination VARCHAR(255) NOT NULL DEFAULT 'Huế',
    start_date DATE,
    end_date DATE,
    max_members INTEGER NOT NULL DEFAULT 10,
    plan_data JSONB DEFAULT '{}',
    cover_image TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'planning'
        CHECK (status IN ('planning', 'confirmed', 'ongoing', 'completed', 'cancelled')),
    chat_room_id UUID REFERENCES chat_rooms(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_creator ON trips(creator_id);
CREATE INDEX IF NOT EXISTS idx_trip_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trip_public ON trips(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_trip_dates ON trips(start_date, end_date);

-- ============================================
-- Trip Members (Thành viên chuyến đi)
-- ============================================
CREATE TABLE IF NOT EXISTS trip_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member'
        CHECK (role IN ('creator', 'admin', 'member', 'guide')),
    status VARCHAR(20) NOT NULL DEFAULT 'invited'
        CHECK (status IN ('invited', 'accepted', 'declined', 'removed')),
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_member_trip ON trip_members(trip_id, status);
CREATE INDEX IF NOT EXISTS idx_trip_member_user ON trip_members(user_id, status);

-- Triggers
CREATE TRIGGER set_friendships_updated_at BEFORE UPDATE ON friendships
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_trips_updated_at BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
