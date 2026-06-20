-- Migration 010: Creator paid subscriptions
-- Safe to re-run (IF NOT EXISTS / IF EXISTS guards on everything)

-- Add subscription price and toggle to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_subscription_enabled  BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_subscription_price    INTEGER     NOT NULL DEFAULT 0; -- in paise
ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_subscriber_count      INTEGER     NOT NULL DEFAULT 0;

-- Add exclusive flag to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for querying exclusive posts
CREATE INDEX IF NOT EXISTS idx_posts_exclusive ON posts (user_id, is_exclusive) WHERE is_exclusive = TRUE;

-- Index for checking active subscriptions quickly
CREATE INDEX IF NOT EXISTS idx_creator_subs_active ON creator_subscriptions (creator_id, subscriber_id, status);
