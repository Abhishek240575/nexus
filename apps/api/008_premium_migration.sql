-- =============================================================================
-- MIGRATION 008 — PREMIUM PLATFORM (Tiers, Billing, Badges, Monetization)
-- =============================================================================

-- ─── Subscription tiers (reference table, seeded) ───────────────────────────
CREATE TABLE IF NOT EXISTS subscription_tiers (
    id              VARCHAR(20)  PRIMARY KEY,         -- 'free' | 'plus' | 'pro' | 'enterprise'
    display_name    VARCHAR(50)  NOT NULL,
    price_inr_paise INTEGER      NOT NULL DEFAULT 0,   -- price in paise (₹99 = 9900)
    billing_period  VARCHAR(10)  NOT NULL DEFAULT 'monthly',
    max_post_length INTEGER      NOT NULL DEFAULT 280,
    max_space_listeners INTEGER  NOT NULL DEFAULT 100,
    features        JSONB        NOT NULL DEFAULT '{}',
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO subscription_tiers (id, display_name, price_inr_paise, max_post_length, max_space_listeners, features) VALUES
  ('free',       'Free',       0,     280,  100,  '{"ads": true, "analytics": "basic", "translation_cache": "standard"}'),
  ('plus',       'Plus',       9900,  1000, 500,  '{"ads": false, "analytics": "advanced", "verified_badge": true, "translation_cache": "priority"}'),
  ('pro',        'Pro',        29900, 1000, 5000, '{"ads": false, "analytics": "advanced", "verified_badge": true, "translation_cache": "priority", "space_recording": true, "ticketed_spaces": true, "priority_visibility": true}'),
  ('enterprise', 'Enterprise', 99900, 1000, -1,   '{"ads": false, "analytics": "advanced", "verified_badge": true, "translation_cache": "priority", "space_recording": true, "ticketed_spaces": true, "priority_visibility": true, "custom_branding": true, "compliance_dashboard": true, "audit_logs": true, "legal_protection_metadata": true}')
ON CONFLICT (id) DO NOTHING;

-- ─── User subscriptions (current + historical) ───────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    tier_id             VARCHAR(20) NOT NULL REFERENCES subscription_tiers (id),
    status              VARCHAR(20) NOT NULL DEFAULT 'active', -- active | past_due | cancelled | expired
    razorpay_customer_id    VARCHAR(100),
    razorpay_subscription_id VARCHAR(100),
    razorpay_plan_id        VARCHAR(100),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end   TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN     NOT NULL DEFAULT FALSE,
    cancelled_at        TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user   ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions (status);
CREATE UNIQUE INDEX idx_subscriptions_active_per_user ON subscriptions (user_id) WHERE status = 'active';

-- ─── Payment transactions (audit trail) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_transactions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    subscription_id     UUID        REFERENCES subscriptions (id) ON DELETE SET NULL,
    razorpay_payment_id VARCHAR(100),
    razorpay_order_id   VARCHAR(100),
    amount_inr_paise    INTEGER     NOT NULL,
    currency            VARCHAR(3)  NOT NULL DEFAULT 'INR',
    status              VARCHAR(20) NOT NULL DEFAULT 'created', -- created | captured | failed | refunded
    purpose             VARCHAR(30) NOT NULL DEFAULT 'subscription', -- subscription | tip | space_ticket
    metadata             JSONB       NOT NULL DEFAULT '{}',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_tx_user ON payment_transactions (user_id);
CREATE INDEX idx_payment_tx_razorpay_order ON payment_transactions (razorpay_order_id);

-- ─── Gamified badges ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badge_types (
    id           VARCHAR(40)  PRIMARY KEY,   -- 'early_supporter' | 'campaign_leader' | 'debate_champion'
    display_name VARCHAR(60)  NOT NULL,
    description  TEXT,
    icon         VARCHAR(10)  NOT NULL DEFAULT '🏆',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO badge_types (id, display_name, description, icon) VALUES
  ('early_supporter', 'Early Supporter', 'One of the first premium subscribers on Deemona', '🌟'),
  ('campaign_leader',  'Campaign Leader', 'Launched a civic campaign that reached its supporter goal', '📢'),
  ('debate_champion',  'Debate Champion', 'Won the most-upvoted argument in a structured debate', '🏆')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_badges (
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    badge_id   VARCHAR(40) NOT NULL REFERENCES badge_types (id),
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    context    JSONB       NOT NULL DEFAULT '{}',  -- e.g. {"campaign_id": "...", "debate_id": "..."}
    PRIMARY KEY (user_id, badge_id, awarded_at)
);

-- ─── Creator monetization: tips ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tips (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id        UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    to_user_id          UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    post_id             UUID        REFERENCES posts (id) ON DELETE SET NULL,
    amount_inr_paise    INTEGER     NOT NULL CHECK (amount_inr_paise > 0),
    message             VARCHAR(280),
    razorpay_payment_id VARCHAR(100),
    status               VARCHAR(20) NOT NULL DEFAULT 'completed',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tips_to_user   ON tips (to_user_id);
CREATE INDEX idx_tips_from_user ON tips (from_user_id);

-- ─── Creator monetization: paid follower subscriptions (exclusive content) ──
CREATE TABLE IF NOT EXISTS creator_subscriptions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id          UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    subscriber_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    price_inr_paise     INTEGER     NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'active',
    razorpay_subscription_id VARCHAR(100),
    current_period_end   TIMESTAMPTZ NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (creator_id, subscriber_id)
);

CREATE INDEX idx_creator_subs_creator    ON creator_subscriptions (creator_id);
CREATE INDEX idx_creator_subs_subscriber ON creator_subscriptions (subscriber_id);

-- ─── Premium Spaces: recording + ticketing ───────────────────────────────────
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS is_ticketed       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS ticket_price_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS is_recorded        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS recording_url      TEXT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS max_listeners       INTEGER NOT NULL DEFAULT 100;

CREATE TABLE IF NOT EXISTS space_tickets (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id            UUID        NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    amount_inr_paise    INTEGER     NOT NULL,
    razorpay_payment_id VARCHAR(100),
    purchased_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (space_id, user_id)
);

-- ─── Community custom branding ───────────────────────────────────────────────
ALTER TABLE communities ADD COLUMN IF NOT EXISTS brand_color      VARCHAR(7);   -- hex
ALTER TABLE communities ADD COLUMN IF NOT EXISTS brand_logo_url   TEXT;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS is_premium_community BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── Journalist legal protection metadata ────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_journalist        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS press_credential_url  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS legal_protection_note TEXT;

-- ─── Audit log (premium accounts + compliance) ───────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        REFERENCES users (id) ON DELETE SET NULL,
    actor_id    UUID        REFERENCES users (id) ON DELETE SET NULL, -- who performed the action (may differ from user_id, e.g. admin/system)
    action      VARCHAR(60) NOT NULL,  -- 'subscription.created' | 'post.moderated' | 'badge.awarded' etc.
    details     JSONB       NOT NULL DEFAULT '{}',
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user   ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_created ON audit_logs (created_at);

-- ─── Priority visibility flag (used by feed ranking for premium posts) ──────
ALTER TABLE posts ADD COLUMN IF NOT EXISTS priority_boost NUMERIC(4,2) NOT NULL DEFAULT 0;

-- ─── Hashtag velocity history (extends beyond 7-day window for premium) ─────
CREATE TABLE IF NOT EXISTS hashtag_velocity_history (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    hashtag     VARCHAR(140) NOT NULL,
    region      VARCHAR(20)  NOT NULL DEFAULT 'national',
    post_count  INTEGER      NOT NULL DEFAULT 0,
    recorded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hashtag_velocity_hashtag ON hashtag_velocity_history (hashtag, recorded_at);

-- ─── Sync existing users.premium_tier with new tiers table ───────────────────
-- (users.premium_tier already exists as a free-text column; this keeps it valid)
UPDATE users SET premium_tier = 'free' WHERE premium_tier IS NULL OR premium_tier NOT IN ('free','plus','pro','enterprise');
