-- =============================================================================
-- MIGRATION 007 — LISTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS lists (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    description   TEXT,
    is_private    BOOLEAN     NOT NULL DEFAULT FALSE,
    member_count  INTEGER     NOT NULL DEFAULT 0,
    follower_count INTEGER    NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lists_owner ON lists (owner_id);

CREATE TABLE IF NOT EXISTS list_members (
    list_id    UUID NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (list_id, user_id)
);

CREATE TABLE IF NOT EXISTS list_followers (
    list_id    UUID NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (list_id, user_id)
);
