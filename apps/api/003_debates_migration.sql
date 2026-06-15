-- =============================================================================
-- MIGRATION 003 — DEBATES
-- =============================================================================

-- Main debates table
CREATE TABLE IF NOT EXISTS debates (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title         VARCHAR(280) NOT NULL,
    description   TEXT,
    category      VARCHAR(50) NOT NULL DEFAULT 'general',
    status        VARCHAR(20) NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'closed', 'archived')),
    for_label     VARCHAR(100) NOT NULL DEFAULT 'For',
    against_label VARCHAR(100) NOT NULL DEFAULT 'Against',
    for_votes     INTEGER NOT NULL DEFAULT 0,
    against_votes INTEGER NOT NULL DEFAULT 0,
    total_arguments INTEGER NOT NULL DEFAULT 0,
    closes_at     TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_debates_creator    ON debates (creator_id);
CREATE INDEX idx_debates_status     ON debates (status);
CREATE INDEX idx_debates_category   ON debates (category);
CREATE INDEX idx_debates_created_at ON debates (created_at DESC);

-- Arguments (posts within a debate)
CREATE TABLE IF NOT EXISTS debate_arguments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    debate_id   UUID        NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    side        VARCHAR(10) NOT NULL CHECK (side IN ('for', 'against')),
    content     TEXT        NOT NULL CHECK (char_length(content) <= 500),
    likes_count INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_debate_arguments_debate ON debate_arguments (debate_id);
CREATE INDEX idx_debate_arguments_user   ON debate_arguments (user_id);
CREATE INDEX idx_debate_arguments_side   ON debate_arguments (side);

-- Argument likes
CREATE TABLE IF NOT EXISTS debate_argument_likes (
    argument_id UUID NOT NULL REFERENCES debate_arguments (id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (argument_id, user_id)
);

-- Debate votes (user votes for a side)
CREATE TABLE IF NOT EXISTS debate_votes (
    debate_id  UUID        NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    side       VARCHAR(10) NOT NULL CHECK (side IN ('for', 'against')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (debate_id, user_id)
);

-- Trigger to update debate vote counts
CREATE OR REPLACE FUNCTION update_debate_votes() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.side = 'for' THEN
      UPDATE debates SET for_votes = for_votes + 1 WHERE id = NEW.debate_id;
    ELSE
      UPDATE debates SET against_votes = against_votes + 1 WHERE id = NEW.debate_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.side = 'for' THEN
      UPDATE debates SET for_votes = GREATEST(for_votes - 1, 0) WHERE id = OLD.debate_id;
    ELSE
      UPDATE debates SET against_votes = GREATEST(against_votes - 1, 0) WHERE id = OLD.debate_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_debate_votes
AFTER INSERT OR DELETE ON debate_votes
FOR EACH ROW EXECUTE FUNCTION update_debate_votes();

-- Trigger to update argument count
CREATE OR REPLACE FUNCTION update_debate_argument_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE debates SET total_arguments = total_arguments + 1 WHERE id = NEW.debate_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE debates SET total_arguments = GREATEST(total_arguments - 1, 0) WHERE id = OLD.debate_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_debate_argument_count
AFTER INSERT OR DELETE ON debate_arguments
FOR EACH ROW EXECUTE FUNCTION update_debate_argument_count();

-- Trigger to update argument likes
CREATE OR REPLACE FUNCTION update_argument_likes() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE debate_arguments SET likes_count = likes_count + 1 WHERE id = NEW.argument_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE debate_arguments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.argument_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_argument_likes
AFTER INSERT OR DELETE ON debate_argument_likes
FOR EACH ROW EXECUTE FUNCTION update_argument_likes();
