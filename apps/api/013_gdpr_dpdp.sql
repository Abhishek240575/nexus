-- Migration 013: GDPR/DPDP compliance tables

-- Consent records
CREATE TABLE IF NOT EXISTS user_consents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type VARCHAR(50) NOT NULL, -- 'terms', 'privacy', 'marketing', 'cookies'
  granted      BOOLEAN NOT NULL DEFAULT TRUE,
  ip_address   VARCHAR(45),
  user_agent   TEXT,
  version      VARCHAR(20) NOT NULL DEFAULT '1.0',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_consents_user ON user_consents (user_id, consent_type);

-- Data export requests
CREATE TABLE IF NOT EXISTS data_export_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, ready, expired
  download_url TEXT,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Account deletion requests
CREATE TABLE IF NOT EXISTS deletion_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason         TEXT,
  scheduled_for  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  cancelled_at   TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nominee designation (DPDP India)
CREATE TABLE IF NOT EXISTS user_nominees (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nominee_name VARCHAR(200) NOT NULL,
  nominee_email VARCHAR(255) NOT NULL,
  nominee_phone VARCHAR(20),
  relationship VARCHAR(100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

-- Breach notifications log
CREATE TABLE IF NOT EXISTS breach_notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  severity      VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  affected_data TEXT[],
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at   TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ,
  notified_users BOOLEAN NOT NULL DEFAULT FALSE
);

-- Add DPDP fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS cookie_consent    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_version   VARCHAR(20) DEFAULT '1.0';
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_export_requested_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted        BOOLEAN NOT NULL DEFAULT FALSE;
