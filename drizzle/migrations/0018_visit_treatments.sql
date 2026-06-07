-- Migration 0018: visit_treatments (many-to-many)
-- A treatment plan can span multiple visits; a visit can work on multiple treatment plans.
-- Replaces the single visit_id column on treatments with a proper junction table.

-- Step 1: Create the junction table
CREATE TABLE IF NOT EXISTS visit_treatments (
  visit_id     TEXT    NOT NULL REFERENCES visits(id),
  treatment_id TEXT    NOT NULL REFERENCES treatments(id),
  notes        TEXT,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (visit_id, treatment_id)
);

CREATE INDEX IF NOT EXISTS idx_vt_visit     ON visit_treatments(visit_id);
CREATE INDEX IF NOT EXISTS idx_vt_treatment ON visit_treatments(treatment_id);

-- Step 2: Migrate existing visit_id links into the junction table
-- (safe to run multiple times — INSERT OR IGNORE)
INSERT OR IGNORE INTO visit_treatments (visit_id, treatment_id, created_at)
SELECT visit_id, id, created_at
FROM treatments
WHERE visit_id IS NOT NULL;

-- Step 3: Drop the now-redundant index and column
-- NOTE: ALTER TABLE ... DROP COLUMN requires SQLite 3.35+ (D1 uses 3.46+).
-- Run this step manually via wrangler if it fails in your environment:
--   wrangler d1 execute parkkal-db --remote \
--     --command "DROP INDEX IF EXISTS idx_treatments_visit; ALTER TABLE treatments DROP COLUMN visit_id;"
DROP INDEX IF EXISTS idx_treatments_visit;
ALTER TABLE treatments DROP COLUMN visit_id;
