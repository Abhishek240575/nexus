-- =============================================================================
-- MIGRATION 006 — COMMUNITY MODERATION
-- =============================================================================

-- Community rules
CREATE TABLE IF NOT EXISTS community_rules (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID        NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
    rule_number  INTEGER     NOT NULL,
    title        VARCHAR(200) NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_community_rules_community ON community_rules (community_id);

-- Community post approvals (mod queue)
CREATE TABLE IF NOT EXISTS community_post_queue (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID        NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
    post_id      UUID        NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    submitted_by UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by  UUID        REFERENCES users (id) ON DELETE SET NULL,
    review_note  TEXT,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (community_id, post_id)
);

CREATE INDEX idx_community_post_queue_community ON community_post_queue (community_id);
CREATE INDEX idx_community_post_queue_status    ON community_post_queue (status);

-- Community bans
CREATE TABLE IF NOT EXISTS community_bans (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID        NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    banned_by    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reason       TEXT,
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (community_id, user_id)
);

CREATE INDEX idx_community_bans_community ON community_bans (community_id);
CREATE INDEX idx_community_bans_user      ON community_bans (user_id);

-- Community reports
CREATE TABLE IF NOT EXISTS community_reports (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID        NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
    post_id      UUID        REFERENCES posts (id) ON DELETE CASCADE,
    reporter_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reason       VARCHAR(100) NOT NULL,
    description  TEXT,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    reviewed_by  UUID        REFERENCES users (id) ON DELETE SET NULL,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_community_reports_community ON community_reports (community_id);
CREATE INDEX idx_community_reports_status    ON community_reports (status);

-- Add requires_approval column to communities
ALTER TABLE communities ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS rules_count INTEGER NOT NULL DEFAULT 0;
