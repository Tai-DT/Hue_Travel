-- ============================================================
-- 008: New Features
-- Report/Block, Guide Registration, Stories/Feed,
-- AI Translation, Collections/Bookmarks
-- ============================================================

-- 1. Report & Block
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id),
    target_type VARCHAR(20) NOT NULL, -- 'user','experience','review','blog','message'
    target_id UUID NOT NULL,
    reason VARCHAR(50) NOT NULL, -- 'spam','harassment','inappropriate','fake','other'
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending','reviewed','resolved','dismissed'
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_report_target ON reports(target_type, target_id);

CREATE TABLE IF NOT EXISTS blocked_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL REFERENCES users(id),
    blocked_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_block_blocker ON blocked_users(blocker_id);

-- 2. Guide Registration
CREATE TABLE IF NOT EXISTS guide_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    specialties TEXT[] DEFAULT '{}',
    experience_years INTEGER NOT NULL DEFAULT 0,
    languages TEXT[] DEFAULT '{vi}',
    bio TEXT,
    id_card_url TEXT,
    certificate_urls TEXT[] DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending','approved','rejected'
    admin_note TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guide_app_status ON guide_applications(status);
CREATE INDEX IF NOT EXISTS idx_guide_app_user ON guide_applications(user_id);

-- 3. Stories / Travel Feed
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES users(id),
    content TEXT,
    media_urls TEXT[] DEFAULT '{}',
    media_type VARCHAR(10) DEFAULT 'image', -- 'image','video'
    location_name VARCHAR(255),
    lat NUMERIC(10,7),
    lng NUMERIC(10,7),
    experience_id UUID REFERENCES experiences(id),
    like_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_story_author ON stories(author_id);
CREATE INDEX IF NOT EXISTS idx_story_created ON stories(created_at DESC);

CREATE TABLE IF NOT EXISTS story_likes (
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(story_id, user_id)
);

CREATE TABLE IF NOT EXISTS story_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_story_comment ON story_comments(story_id);

-- 4. Collections / Bookmarks
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    cover_image TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    item_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_collection_user ON collections(user_id);

CREATE TABLE IF NOT EXISTS collection_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL, -- 'experience','place','blog','event'
    item_id UUID NOT NULL,
    note TEXT,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(collection_id, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS idx_coll_item ON collection_items(collection_id);
