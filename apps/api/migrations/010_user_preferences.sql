CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    locale VARCHAR(10) NOT NULL DEFAULT 'vi',
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    region VARCHAR(100) NOT NULL DEFAULT 'Hue, Vietnam',
    push_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    chat_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    promo_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_updated_at ON user_preferences(updated_at DESC);
