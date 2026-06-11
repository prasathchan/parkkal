CREATE TABLE IF NOT EXISTS org_backups (
  id             TEXT    PRIMARY KEY,
  organization_id TEXT   NOT NULL REFERENCES organizations(id),
  type           TEXT    NOT NULL CHECK(type IN ('auto', 'manual')),
  status         TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
  r2_key         TEXT,
  size_bytes     INTEGER,
  row_counts     TEXT,
  error_message  TEXT,
  created_by     TEXT    REFERENCES users(id),
  created_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_backups_org_created
  ON org_backups(organization_id, created_at DESC);
