-- Migration 015: Stories, E2E DMs, Voice Notes, Bot Detection, Orgs, Webhooks

-- ─── Stories (24hr disappearing posts) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS stories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_url    TEXT NOT NULL,
  media_type   VARCHAR(10) NOT NULL DEFAULT 'image', -- image, video
  caption      TEXT,
  bg_color     VARCHAR(20) DEFAULT '#1d9bf0',
  duration_sec INTEGER NOT NULL DEFAULT 5,
  view_count   INTEGER NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stories_user    ON stories (user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories (expires_at);

CREATE TABLE IF NOT EXISTS story_views (
  story_id   UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, viewer_id)
);

-- ─── E2E Encrypted DMs ────────────────────────────────────────────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_encrypted    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted_data  TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS iv              VARCHAR(32);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type    VARCHAR(20) NOT NULL DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS voice_url       TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS voice_duration  INTEGER; -- seconds
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_url        TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name       TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions       JSONB DEFAULT '{}';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id     UUID REFERENCES messages(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted      BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS disappears_at   TIMESTAMPTZ;

-- User key pairs for E2E encryption
CREATE TABLE IF NOT EXISTS user_key_pairs (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_key   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at   TIMESTAMPTZ
);

-- ─── Bot Detection ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_signals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_type  VARCHAR(50) NOT NULL,
  score        INTEGER NOT NULL DEFAULT 0,
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bot_signals_user ON bot_signals (user_id, created_at);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_score    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_flagged_at TIMESTAMPTZ;

-- ─── Organization / Brand Pages ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle          VARCHAR(50) UNIQUE NOT NULL,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  avatar_url      TEXT,
  cover_url       TEXT,
  website         TEXT,
  org_type        VARCHAR(30) NOT NULL DEFAULT 'brand', -- brand, ngo, government, media, startup
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  owner_id        UUID NOT NULL REFERENCES users(id),
  follower_count  INTEGER NOT NULL DEFAULT 0,
  post_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL DEFAULT 'member', -- owner, admin, member
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS org_follows (
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

-- ─── Developer Webhooks ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  secret       VARCHAR(64) NOT NULL,
  events       TEXT[] NOT NULL DEFAULT '{}',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  last_ping_at TIMESTAMPTZ,
  fail_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id  UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event       VARCHAR(50) NOT NULL,
  payload     JSONB NOT NULL,
  status_code INTEGER,
  success     BOOLEAN NOT NULL DEFAULT FALSE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AI Semantic Search index hint ───────────────────────────────────────────
-- Full text search on posts (using PostgreSQL tsvector)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;
CREATE INDEX IF NOT EXISTS idx_posts_fts ON posts USING GIN (search_vector);

-- Trigger to update search vector
CREATE OR REPLACE FUNCTION update_post_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_search_vector_trigger ON posts;
CREATE TRIGGER posts_search_vector_trigger
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_post_search_vector();

-- Backfill existing posts
UPDATE posts SET search_vector = to_tsvector('english', COALESCE(content, '')) WHERE content IS NOT NULL;
