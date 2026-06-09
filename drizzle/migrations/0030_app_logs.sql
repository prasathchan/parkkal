-- Migration 0030: app_logs
--
-- Lightweight self-hosted error & security event log.
--
-- WHAT GETS STORED:
--   - 'error'    — unhandled exceptions caught by withRoute()
--   - 'security' — auth failures, permission denials, revoked token attempts
--   - 'warn'     — degraded-mode events worth investigating
--
-- WHAT DOES NOT GET STORED (to keep volume manageable):
--   - 'info' / 'debug' — use `wrangler tail` or Cloudflare dashboard for those
--
-- organization_id is nullable so pre-auth errors (bad JWT, missing session)
-- can still be captured when no session context is available.
--
-- The data column holds a JSON string of arbitrary structured context
-- (route, userId, orgId, errorStack, etc.) assembled by writeAppLog().
--
-- Retention: rows can be safely pruned after 90 days.
--   DELETE FROM app_logs WHERE created_at < (unixepoch() - 90*86400) * 1000;

CREATE TABLE IF NOT EXISTS app_logs (
  id              TEXT    NOT NULL PRIMARY KEY,
  level           TEXT    NOT NULL,                      -- 'error' | 'security' | 'warn'
  route           TEXT    NOT NULL,
  message         TEXT    NOT NULL,
  organization_id TEXT,                                  -- nullable — may be absent on pre-auth errors
  user_id         TEXT,
  user_role       TEXT,
  error_name      TEXT,                                  -- Error.name  (e.g. "TypeError")
  error_stack     TEXT,                                  -- Error.stack truncated to 2 KB
  data            TEXT,                                  -- JSON: arbitrary structured context
  created_at      INTEGER NOT NULL
);

-- Fast queries for the admin viewer
CREATE INDEX IF NOT EXISTS idx_app_logs_created  ON app_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level    ON app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_org      ON app_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_route    ON app_logs(route);
