-- Migration 0046: onboarding email sequence table
CREATE TABLE IF NOT EXISTS onboarding_emails (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  step            INTEGER NOT NULL,   -- 0=welcome, 1=day1, 2=day3, 3=day7
  scheduled_at    INTEGER NOT NULL,
  sent_at         INTEGER,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_onboarding_emails_pending
  ON onboarding_emails (scheduled_at)
  WHERE status = 'pending';
