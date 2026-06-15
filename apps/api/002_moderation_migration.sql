-- =============================================================================
-- MIGRATION 002 — AI CONTENT MODERATION TABLES
-- =============================================================================

-- Add moderation columns to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS language      VARCHAR(50);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS has_warning   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS warning_reason TEXT;

-- Moderation queue for flagged posts
CREATE TABLE IF NOT EXISTS moderation_queue (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID        NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    ai_decision     VARCHAR(10) NOT NULL CHECK (ai_decision IN ('PASS','WARN','FLAG','BLOCK')),
    ai_reason       TEXT,
    ai_categories   TEXT[]      DEFAULT '{}',
    ai_confidence   NUMERIC(4,3),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','warned')),
    reviewed_by     UUID        REFERENCES users (id) ON DELETE SET NULL,
    reviewer_note   TEXT,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_moderation_queue_status     ON moderation_queue (status);
CREATE INDEX idx_moderation_queue_post_id    ON moderation_queue (post_id);
CREATE INDEX idx_moderation_queue_created_at ON moderation_queue (created_at DESC);

-- User bans table
CREATE TABLE IF NOT EXISTS user_bans (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    banned_by   UUID        REFERENCES users (id) ON DELETE SET NULL,
    reason      TEXT        NOT NULL,
    permanent   BOOLEAN     NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_bans_user_id    ON user_bans (user_id);
CREATE INDEX idx_user_bans_expires_at ON user_bans (expires_at);

-- Content warnings view
CREATE OR REPLACE VIEW warned_posts AS
SELECT p.*, u.handle AS author_handle
FROM posts p JOIN users u ON u.id = p.user_id
WHERE p.has_warning = TRUE AND p.is_published = TRUE;

-- Moderation stats view
CREATE OR REPLACE VIEW moderation_summary AS
SELECT
    DATE(mq.created_at) AS date,
    COUNT(*) FILTER (WHERE mq.ai_decision = 'PASS')  AS passed,
    COUNT(*) FILTER (WHERE mq.ai_decision = 'WARN')  AS warned,
    COUNT(*) FILTER (WHERE mq.ai_decision = 'FLAG')  AS flagged,
    COUNT(*) FILTER (WHERE mq.ai_decision = 'BLOCK') AS blocked,
    COUNT(*) FILTER (WHERE mq.status = 'pending')    AS pending_review
FROM moderation_queue mq
GROUP BY DATE(mq.created_at)
ORDER BY date DESC;
