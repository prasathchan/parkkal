-- Migration 0029: revoked_tokens
--
-- Enables explicit token revocation (logout on all devices, staff deactivation).
-- A JWT whose jti appears here is rejected by withRoute() even if the signature
-- is otherwise valid and not yet expired.
--
-- Rows are safe to delete once expires_at < now() — they can no longer match a
-- live token anyway. A periodic cleanup job (or manual CRON) should run:
--   DELETE FROM revoked_tokens WHERE expires_at < unixepoch() * 1000;

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        TEXT    PRIMARY KEY,                   -- JWT ID claim (uuid)
  expires_at INTEGER NOT NULL,                      -- Unix ms — when the original token expires
  revoked_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);
