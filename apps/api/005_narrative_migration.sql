-- =============================================================================
-- MIGRATION 005 — NARRATIVE TOOLS
-- =============================================================================

-- Pinned posts (platform-wide important posts)
CREATE TABLE IF NOT EXISTS pinned_posts (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id    UUID        NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    pinned_by  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reason     TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pinned_posts_post_id ON pinned_posts (post_id);

-- Hashtag campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    hashtag       VARCHAR(100) NOT NULL,
    title         VARCHAR(280) NOT NULL,
    description   TEXT,
    goal          TEXT,
    category      VARCHAR(50) NOT NULL DEFAULT 'general',
    status        VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'ended', 'archived')),
    post_count    INTEGER NOT NULL DEFAULT 0,
    supporter_count INTEGER NOT NULL DEFAULT 0,
    starts_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_hashtag    ON campaigns (hashtag);
CREATE INDEX idx_campaigns_status     ON campaigns (status);
CREATE INDEX idx_campaigns_created_at ON campaigns (created_at DESC);

-- Campaign supporters
CREATE TABLE IF NOT EXISTS campaign_supporters (
    campaign_id UUID NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (campaign_id, user_id)
);

-- Trigger to update supporter count
CREATE OR REPLACE FUNCTION update_campaign_supporters() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE campaigns SET supporter_count = supporter_count + 1 WHERE id = NEW.campaign_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE campaigns SET supporter_count = GREATEST(supporter_count - 1, 0) WHERE id = OLD.campaign_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campaign_supporters
AFTER INSERT OR DELETE ON campaign_supporters
FOR EACH ROW EXECUTE FUNCTION update_campaign_supporters();

-- Trending topics (materialized for performance)
CREATE TABLE IF NOT EXISTS trending_topics (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    hashtag      VARCHAR(100) NOT NULL,
    post_count   INTEGER NOT NULL DEFAULT 0,
    region       VARCHAR(50) NOT NULL DEFAULT 'national',
    category     VARCHAR(50),
    velocity     NUMERIC(10,2) DEFAULT 0, -- posts per hour
    peak_at      TIMESTAMPTZ,
    computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trending_topics_hashtag    ON trending_topics (hashtag);
CREATE INDEX idx_trending_topics_region     ON trending_topics (region);
CREATE INDEX idx_trending_topics_post_count ON trending_topics (post_count DESC);
