-- Migration 014: OAuth provider columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users (github_id) WHERE github_id IS NOT NULL;

-- Add get me endpoint helper
-- (No schema change needed, just ensure users have all fields)
