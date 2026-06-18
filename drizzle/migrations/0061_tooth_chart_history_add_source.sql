-- Migration 0061: Add source column to tooth_chart_history
--
-- D1 (SQLite) does not support ALTER TABLE ADD COLUMN IF NOT EXISTS.
-- Staging DBs already have this column from the retired 0048_tooth_condition_history
-- migration. We use table recreation — the canonical SQLite migration pattern —
-- which is safe regardless of whether the column already exists.
--
-- tooth_chart_history has no incoming FK constraints, so DROP + RENAME is safe.
-- The INSERT uses a literal 'manual' for source (not SELECT source) so it works
-- on both staging (column present) and fresh DBs (column absent).

CREATE TABLE tooth_chart_history_new (
  id              TEXT    PRIMARY KEY,
  organization_id TEXT    NOT NULL REFERENCES organizations(id),
  patient_id      TEXT    NOT NULL REFERENCES patients(id),
  visit_id        TEXT    REFERENCES visits(id),
  tooth_data      TEXT    NOT NULL,
  changed_teeth   TEXT    NOT NULL DEFAULT '[]',
  source          TEXT    NOT NULL DEFAULT 'manual',
  recorded_by     TEXT    NOT NULL REFERENCES users(id),
  recorded_at     INTEGER NOT NULL
);

INSERT INTO tooth_chart_history_new
  SELECT id, organization_id, patient_id, visit_id, tooth_data, changed_teeth,
         'manual', recorded_by, recorded_at
  FROM tooth_chart_history;

DROP TABLE tooth_chart_history;

ALTER TABLE tooth_chart_history_new RENAME TO tooth_chart_history;

CREATE INDEX IF NOT EXISTS idx_tooth_chart_history_patient
  ON tooth_chart_history(organization_id, patient_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_tooth_chart_history_visit
  ON tooth_chart_history(visit_id);
