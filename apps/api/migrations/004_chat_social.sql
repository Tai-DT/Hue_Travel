-- ============================================
-- Huế Travel — Chat Social Features Migration
-- Reactions, Calls, Voice Messages
-- ============================================

-- ============================================
-- Message Reactions (thả icon)
-- ============================================
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(20) NOT NULL, -- '❤️', '😂', '👍', '😮', '😢', '🔥'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reaction_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reaction_user ON message_reactions(user_id);

-- ============================================
-- Calls (voice & video call history)
-- ============================================
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    caller_id UUID NOT NULL REFERENCES users(id),
    call_type VARCHAR(10) NOT NULL DEFAULT 'voice'
        CHECK (call_type IN ('voice', 'video')),
    status VARCHAR(20) NOT NULL DEFAULT 'ringing'
        CHECK (status IN ('ringing', 'ongoing', 'ended', 'missed', 'declined', 'failed')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_secs INTEGER DEFAULT 0,
    is_group_call BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_room ON calls(room_id);
CREATE INDEX IF NOT EXISTS idx_call_caller ON calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_status ON calls(status) WHERE status IN ('ringing', 'ongoing');

-- ============================================
-- Call Participants (cho group call)
-- ============================================
CREATE TABLE IF NOT EXISTS call_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'invited'
        CHECK (status IN ('invited', 'ringing', 'joined', 'left', 'declined', 'missed')),
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    UNIQUE(call_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_call_part_call ON call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_call_part_user ON call_participants(user_id);
