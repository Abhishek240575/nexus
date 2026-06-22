-- Migration 012: Space recording support
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS is_recorded     BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS egress_id       TEXT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS recording_url   TEXT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS recording_filename TEXT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS recording_duration INTEGER; -- seconds

-- Fix velocity cron: add region column to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS region VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_posts_region ON posts (region);
