-- Migration 0017: consent_audit_log
-- Append-only audit trail for emergency consent overrides.

CREATE TABLE IF NOT EXISTS consent_audit_log (
  id          TEXT    PRIMARY KEY NOT NULL,
  treatment_id TEXT   NOT NULL REFERENCES treatments(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  actor_id    TEXT    NOT NULL REFERENCES users(id),
  actor_role  TEXT    NOT NULL,
  action      TEXT    NOT NULL,
  reason      TEXT,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consent_audit_treatment ON consent_audit_log(treatment_id);
CREATE INDEX IF NOT EXISTS idx_consent_audit_org ON consent_audit_log(organization_id);
