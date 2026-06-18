-- Migration: 0054_superadmin_actions
-- Append-only audit log for superadmin actions.
-- Superadmin operations span all organizations so they are logged separately
-- from the per-org audit_log table. Rows are never updated or deleted.

CREATE TABLE IF NOT EXISTS superadmin_actions (
  id         TEXT    PRIMARY KEY,
  actor_id   TEXT    NOT NULL REFERENCES users(id),
  action     TEXT    NOT NULL,
  data       TEXT,             -- JSON blob with request details
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_superadmin_actions_actor
  ON superadmin_actions (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_superadmin_actions_created
  ON superadmin_actions (created_at DESC);
