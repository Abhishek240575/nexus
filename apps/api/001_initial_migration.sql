-- Migration 001: Initial Schema for Deemona Microblogging Platform
-- Run this first before all other migrations

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle            VARCHAR(50)  UNIQUE NOT NULL,
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     VARCHAR(255),
  display_name      VARCHAR(100),
  bio               TEXT,
  avatar_url        TEXT,
  cover_url         TEXT,
  location          VARCHAR(100),
  website           VARCHAR(255),
  verified          BOOLEAN      NOT NULL DEFAULT FALSE,
  email_verified    BOOLEAN      NOT NULL DEFAULT FALSE,
  suspended         BOOLEAN      NOT NULL DEFAULT FALSE,
  suspension_reason TEXT,
  premium_tier      VARCHAR(20)  NOT NULL DEFAULT 'free',
  is_journalist     BOOLEAN      NOT NULL DEFAULT FALSE,
  press_credential_url TEXT,
  followers_count   INTEGER      NOT NULL DEFAULT 0,
  following_count   INTEGER      NOT NULL DEFAULT 0,
  posts_count       INTEGER      NOT NULL DEFAULT 0,
  google_id         VARCHAR(100),
  github_id         VARCHAR(100),
  is_onboarded      BOOLEAN      NOT NULL DEFAULT FALSE,
  preferred_langs   TEXT[]       NOT NULL DEFAULT '{en}',
  interests         TEXT[]       NOT NULL DEFAULT '{}',
  cookie_consent    BOOLEAN      NOT NULL DEFAULT FALSE,
  consent_version   VARCHAR(20)  DEFAULT '1.0',
  deletion_requested_at TIMESTAMPTZ,
  data_export_requested_at TIMESTAMPTZ,
  is_deleted        BOOLEAN      NOT NULL DEFAULT FALSE,
  bot_score         INTEGER      NOT NULL DEFAULT 0,
  is_bot            BOOLEAN      NOT NULL DEFAULT FALSE,
  bot_flagged_at    TIMESTAMPTZ,
  creator_subscription_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  creator_subscription_price   INTEGER NOT NULL DEFAULT 0,
  creator_subscriber_count     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_handle    ON users (handle);
CREATE INDEX IF NOT EXISTS idx_users_email     ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users (github_id) WHERE github_id IS NOT NULL;

-- Posts
CREATE TABLE IF NOT EXISTS posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT,
  media_urls      TEXT[]      NOT NULL DEFAULT '{}',
  reply_to_id     UUID        REFERENCES posts(id) ON DELETE SET NULL,
  quote_of_id     UUID        REFERENCES posts(id) ON DELETE SET NULL,
  community_id    UUID,
  likes_count     INTEGER     NOT NULL DEFAULT 0,
  reposts_count   INTEGER     NOT NULL DEFAULT 0,
  replies_count   INTEGER     NOT NULL DEFAULT 0,
  views_count     INTEGER     NOT NULL DEFAULT 0,
  priority_boost  INTEGER     NOT NULL DEFAULT 0,
  is_published    BOOLEAN     NOT NULL DEFAULT TRUE,
  scheduled_at    TIMESTAMPTZ,
  has_warning     BOOLEAN     NOT NULL DEFAULT FALSE,
  warning_reason  TEXT,
  language        VARCHAR(10),
  is_exclusive    BOOLEAN     NOT NULL DEFAULT FALSE,
  region          VARCHAR(20),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_user_id   ON posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_reply_to  ON posts (reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts (is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_language  ON posts (language);
CREATE INDEX IF NOT EXISTS idx_posts_exclusive ON posts (user_id, is_exclusive) WHERE is_exclusive = TRUE;
CREATE INDEX IF NOT EXISTS idx_posts_region    ON posts (region);

-- Follows
CREATE TABLE IF NOT EXISTS follows (
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows (following_id);

-- Likes
CREATE TABLE IF NOT EXISTS likes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes (post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes (user_id, created_at DESC);

-- Reposts
CREATE TABLE IF NOT EXISTS reposts (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_reposts_post_id ON reposts (post_id);

-- Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks (user_id, created_at DESC);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(30) NOT NULL CHECK (type IN (
    'like','repost','quote','reply','follow','mention','dm',
    'space_invite','community_invite','poll_ended','system'
  )),
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread     ON notifications (user_id) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);

-- Conversations & Messages
CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants (user_id);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT,
  message_type    VARCHAR(20) NOT NULL DEFAULT 'text',
  is_encrypted    BOOLEAN NOT NULL DEFAULT FALSE,
  encrypted_data  TEXT,
  iv              VARCHAR(32),
  voice_url       TEXT,
  voice_duration  INTEGER,
  file_url        TEXT,
  file_name       TEXT,
  reactions       JSONB DEFAULT '{}',
  reply_to_id     UUID REFERENCES messages(id),
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  disappears_at   TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender       ON messages (sender_id);

-- Hashtag velocity
CREATE TABLE IF NOT EXISTS hashtag_velocity_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hashtag     VARCHAR(100) NOT NULL,
  region      VARCHAR(20)  NOT NULL DEFAULT 'national',
  post_count  INTEGER      NOT NULL DEFAULT 0,
  velocity    FLOAT        NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hashtag_velocity ON hashtag_velocity_history (region, snapshot_at DESC);

-- Polls
CREATE TABLE IF NOT EXISTS polls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  options     JSONB NOT NULL DEFAULT '[]',
  votes       JSONB NOT NULL DEFAULT '{}',
  total_votes INTEGER NOT NULL DEFAULT 0,
  ends_at     TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id    UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_idx INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);

-- Lists
CREATE TABLE IF NOT EXISTS lists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  is_private   BOOLEAN NOT NULL DEFAULT FALSE,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS list_members (
  list_id    UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, user_id)
);

-- Communities
CREATE TABLE IF NOT EXISTS communities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle       VARCHAR(50) UNIQUE NOT NULL,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  avatar_url   TEXT,
  cover_url    TEXT,
  rules        TEXT,
  is_private   BOOLEAN NOT NULL DEFAULT FALSE,
  member_count INTEGER NOT NULL DEFAULT 0,
  post_count   INTEGER NOT NULL DEFAULT 0,
  owner_id     UUID NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_members (
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         VARCHAR(20) NOT NULL DEFAULT 'member',
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(100) NOT NULL,
  details    JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id, created_at DESC);

-- Spaces
CREATE TABLE IF NOT EXISTS spaces (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title              VARCHAR(200) NOT NULL,
  description        TEXT,
  category           VARCHAR(50)  NOT NULL DEFAULT 'general',
  status             VARCHAR(20)  NOT NULL DEFAULT 'scheduled',
  room_name          VARCHAR(100) UNIQUE NOT NULL,
  livekit_token      TEXT,
  listener_count     INTEGER      NOT NULL DEFAULT 0,
  max_listeners      INTEGER      NOT NULL DEFAULT 1000,
  is_ticketed        BOOLEAN      NOT NULL DEFAULT FALSE,
  ticket_price_inr   INTEGER      NOT NULL DEFAULT 0,
  is_recorded        BOOLEAN      NOT NULL DEFAULT FALSE,
  egress_id          TEXT,
  recording_url      TEXT,
  recording_filename TEXT,
  recording_duration INTEGER,
  started_at         TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ,
  scheduled_for      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spaces_host   ON spaces (host_id);
CREATE INDEX IF NOT EXISTS idx_spaces_status ON spaces (status);

CREATE TABLE IF NOT EXISTS space_participants (
  space_id  UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      VARCHAR(20) NOT NULL DEFAULT 'listener',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (space_id, user_id)
);

-- Tips
CREATE TABLE IF NOT EXISTS tips (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id        UUID NOT NULL REFERENCES users(id),
  to_user_id          UUID NOT NULL REFERENCES users(id),
  amount_inr_paise    INTEGER NOT NULL,
  message             TEXT,
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  razorpay_payment_id TEXT,
  razorpay_order_id   TEXT,
  amount_inr_paise    INTEGER NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  purpose             VARCHAR(50),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscription tiers
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(20) UNIQUE NOT NULL,
  price_inr_monthly INTEGER NOT NULL DEFAULT 0,
  max_post_length   INTEGER NOT NULL DEFAULT 280,
  features          JSONB   NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO subscription_tiers (name, price_inr_monthly, max_post_length, features) VALUES
  ('free',       0,   280,  '{"analytics":false,"spaces_recording":false}'),
  ('plus',       99,  1000, '{"analytics":true,"spaces_recording":false}'),
  ('pro',        299, 1000, '{"analytics":true,"spaces_recording":true}'),
  ('enterprise', 999, 1000, '{"analytics":true,"spaces_recording":true,"community_branding":true}')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier                     VARCHAR(20) NOT NULL DEFAULT 'free',
  status                   VARCHAR(20) NOT NULL DEFAULT 'active',
  razorpay_subscription_id TEXT,
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Creator subscriptions
CREATE TABLE IF NOT EXISTS creator_subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscriber_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_inr_paise          INTEGER NOT NULL,
  status                   VARCHAR(20) NOT NULL DEFAULT 'active',
  razorpay_subscription_id TEXT,
  current_period_end       TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (creator_id, subscriber_id)
);
CREATE INDEX IF NOT EXISTS idx_creator_subs_creator    ON creator_subscriptions (creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_subs_subscriber ON creator_subscriptions (subscriber_id);
CREATE INDEX IF NOT EXISTS idx_creator_subs_active     ON creator_subscriptions (creator_id, subscriber_id, status);
