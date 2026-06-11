-- Atomic patient code sequence counters.
--
-- Replaces the SELECT COUNT(*) approach which can produce duplicate codes under
-- concurrent inserts. Each row holds the last-used sequence number for a scope:
--   scope='global'           → PKL-XXXXXX (cross-org global code)
--   scope='org:{orgSlug}'    → {ORG}-XXXX  (per-org display code)
--
-- The UPDATE ... RETURNING pattern atomically increments and returns the new
-- value, eliminating the race condition entirely.

CREATE TABLE IF NOT EXISTS patient_code_sequences (
  scope      TEXT PRIMARY KEY,
  last_seq   INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Seed the global counter from the current patient count so existing codes are
-- not reused. The INSERT OR IGNORE means a re-run of this migration is safe.
INSERT OR IGNORE INTO patient_code_sequences (scope, last_seq, updated_at)
SELECT 'global', COUNT(*), unixepoch() * 1000 FROM patients;
