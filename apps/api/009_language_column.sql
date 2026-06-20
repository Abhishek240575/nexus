-- Migration 009: Ensure language column exists on posts (safe to re-run)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS language VARCHAR(10);
CREATE INDEX IF NOT EXISTS idx_posts_language ON posts (language);

-- Backfill: posts without language set will be auto-detected on first translation request
-- (No batch backfill needed — the translation controller handles it lazily)
