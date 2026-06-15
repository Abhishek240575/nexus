-- =============================================================================
-- MIGRATION 004 — LIVE SPACES
-- =============================================================================

CREATE TABLE IF NOT EXISTS spaces (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title         VARCHAR(280) NOT NULL,
    description   TEXT,
    category      VARCHAR(50) NOT NULL DEFAULT 'general',
    status        VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled', 'live', 'ended')),
    room_name     VARCHAR(255) UNIQUE NOT NULL,
    listener_count INTEGER NOT NULL DEFAULT 0,
    speaker_count  INTEGER NOT NULL DEFAULT 0,
    scheduled_at  TIMESTAMPTZ,
    started_at    TIMESTAMPTZ,
    ended_at      TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spaces_host_id   ON spaces (host_id);
CREATE INDEX idx_spaces_status    ON spaces (status);
CREATE INDEX idx_spaces_created_at ON spaces (created_at DESC);

CREATE TABLE IF NOT EXISTS space_participants (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id    UUID        NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL DEFAULT 'listener'
                    CHECK (role IN ('host', 'speaker', 'listener')),
    is_muted    BOOLEAN     NOT NULL DEFAULT FALSE,
    hand_raised BOOLEAN     NOT NULL DEFAULT FALSE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at     TIMESTAMPTZ,
    UNIQUE (space_id, user_id)
);

CREATE INDEX idx_space_participants_space ON space_participants (space_id);
CREATE INDEX idx_space_participants_user  ON space_participants (user_id);
