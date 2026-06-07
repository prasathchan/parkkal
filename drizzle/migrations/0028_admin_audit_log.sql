-- Migration 0028: Admin audit log table
-- Tracks all sensitive admin actions for compliance and security review.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id           TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  actor_id     TEXT NOT NULL,
  actor_role   TEXT NOT NULL,
  action       TEXT NOT NULL,
  target_type  TEXT NOT NULL,
  target_id    TEXT,
  metadata     TEXT,             -- JSON blob with extra context
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_org
  ON admin_audit_log(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor
  ON admin_audit_log(actor_id, created_at DESC);
