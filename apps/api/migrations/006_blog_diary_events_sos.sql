-- ============================================
-- Huế Travel — Blog, Diary, Events, SOS
-- ============================================

-- ============================================
-- Blog Posts (Bài viết du lịch)
-- ============================================
CREATE TABLE IF NOT EXISTS blog_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES users(id),
    slug VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    cover_image TEXT,
    tags TEXT[] DEFAULT '{}',
    category VARCHAR(50) NOT NULL DEFAULT 'tips'
        CHECK (category IN ('tips', 'culture', 'food', 'history', 'nature', 'guide', 'news', 'story')),
    view_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_author ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_category ON blog_posts(category);

-- Blog Likes
CREATE TABLE IF NOT EXISTS blog_likes (
    blog_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blog_id, user_id)
);

-- Blog Comments
CREATE TABLE IF NOT EXISTS blog_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blog_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_comment ON blog_comments(blog_id, created_at DESC);

-- ============================================
-- Travel Diary (Nhật ký du lịch)
-- ============================================
CREATE TABLE IF NOT EXISTS diary_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    mood VARCHAR(20) DEFAULT 'happy'
        CHECK (mood IN ('happy', 'excited', 'relaxed', 'amazed', 'tired', 'love')),
    location_name VARCHAR(255),
    lat DECIMAL(10,7),
    lng DECIMAL(10,7),
    photo_urls TEXT[] DEFAULT '{}',
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    weather VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diary_user ON diary_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_public ON diary_entries(is_public) WHERE is_public = TRUE;

-- ============================================
-- Local Events (Sự kiện Huế)
-- ============================================
CREATE TABLE IF NOT EXISTS local_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'festival'
        CHECK (category IN ('festival', 'concert', 'exhibition', 'food', 'sport', 'workshop', 'market', 'other')),
    location_name VARCHAR(255) NOT NULL,
    lat DECIMAL(10,7),
    lng DECIMAL(10,7),
    cover_image TEXT,
    organizer VARCHAR(255),
    price BIGINT DEFAULT 0,
    is_free BOOLEAN NOT NULL DEFAULT TRUE,
    max_attendees INTEGER,
    attendee_count INTEGER NOT NULL DEFAULT 0,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_date ON local_events(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_event_category ON local_events(category);

-- Event RSVPs
CREATE TABLE IF NOT EXISTS event_rsvps (
    event_id UUID NOT NULL REFERENCES local_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'going'
        CHECK (status IN ('going', 'interested', 'not_going')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

-- ============================================
-- Emergency SOS
-- ============================================
CREATE TABLE IF NOT EXISTS sos_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    alert_type VARCHAR(30) NOT NULL DEFAULT 'emergency'
        CHECK (alert_type IN ('emergency', 'medical', 'police', 'fire', 'lost', 'other')),
    message TEXT,
    lat DECIMAL(10,7) NOT NULL,
    lng DECIMAL(10,7) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'responding', 'resolved', 'cancelled')),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sos_user ON sos_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_active ON sos_alerts(status) WHERE status = 'active';

-- ============================================
-- Triggers
-- ============================================
CREATE TRIGGER set_blog_updated_at BEFORE UPDATE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_diary_updated_at BEFORE UPDATE ON diary_entries
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================
-- Seed: Sample Events
-- ============================================
INSERT INTO local_events (title, description, category, location_name, lat, lng, is_free, starts_at, ends_at) VALUES
('Festival Huế 2026', 'Lễ hội Festival Huế — Di sản văn hóa, âm nhạc, nghệ thuật đường phố', 'festival', 'Đại Nội Huế', 16.4698, 107.5789, true, '2026-04-15 08:00:00+07', '2026-04-21 22:00:00+07'),
('Chợ đêm Phố cổ Bao Vinh', 'Chợ đêm ẩm thực và thủ công mỹ nghệ', 'market', 'Phố cổ Bao Vinh', 16.4780, 107.5920, true, '2026-03-20 17:00:00+07', '2026-03-20 23:00:00+07'),
('Đêm nhạc Jazz sông Hương', 'Biểu diễn nhạc Jazz trên thuyền Rồng', 'concert', 'Bến thuyền Tòa Khâm', 16.4620, 107.5850, false, '2026-03-25 19:00:00+07', '2026-03-25 22:00:00+07'),
('Triển lãm Mỹ thuật Huế', 'Triển lãm tranh và điêu khắc nghệ nhân Huế', 'exhibition', 'Trung tâm Nghệ thuật Lê Bá Đảng', 16.4650, 107.5800, true, '2026-04-01 09:00:00+07', '2026-04-30 17:00:00+07'),
('Workshop làm bánh Huế', 'Học làm bánh lọc, bánh nậm, bánh bèo', 'workshop', 'Nhà vườn Kim Long', 16.4550, 107.5700, false, '2026-03-22 09:00:00+07', '2026-03-22 12:00:00+07')
ON CONFLICT DO NOTHING;

-- Seed: Sample Blog Posts
INSERT INTO blog_posts (author_id, slug, title, excerpt, content, category, tags, is_featured, published_at)
SELECT id, '10-dieu-phai-lam-o-hue', '10 điều phải làm khi đến Huế',
    'Khám phá những trải nghiệm không thể bỏ lỡ tại cố đô Huế.',
    E'# 10 điều phải làm khi đến Huế\n\n## 1. Tham quan Đại Nội\nĐại Nội Huế là quần thể di tích lớn nhất...\n\n## 2. Thưởng thức bún bò Huế\nMón ăn biểu tượng...\n\n## 3. Đi thuyền trên sông Hương\nDòng sông thơ mộng...\n\n## 4. Khám phá lăng tẩm\nLăng Tự Đức, Lăng Minh Mạng...\n\n## 5. Chợ Đông Ba\nTrung tâm mua sắm...',
    'tips', ARRAY['huế', 'du lịch', 'top 10'], true, NOW()
FROM users WHERE role = 'admin' LIMIT 1;
