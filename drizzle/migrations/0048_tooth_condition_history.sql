-- Migration: 0048_tooth_condition_history
-- Adds per-tooth condition history table for bi-directional chart ↔ treatment sync.
-- Also adds source column to tooth_chart_history to distinguish manual edits from
-- treatment-driven chart updates.

-- Per-tooth condition change log.
-- One row per tooth per condition change. Separate from tooth_chart_history (which
-- stores full-chart snapshots). This table is queryable per-tooth and links changes
-- back to the treatment that caused them.
CREATE TABLE IF NOT EXISTS tooth_condition_history (
  id              TEXT    PRIMARY KEY,
  organization_id TEXT    NOT NULL REFERENCES organizations(id),
  patient_id      TEXT    NOT NULL REFERENCES patients(id),
  tooth_number    TEXT    NOT NULL,
  previous_condition TEXT,
  new_condition   TEXT    NOT NULL,
  visit_id        TEXT    REFERENCES visits(id),
  treatment_id    TEXT    REFERENCES treatments(id),
  source          TEXT    NOT NULL DEFAULT 'manual',
  recorded_by     TEXT    NOT NULL REFERENCES users(id),
  recorded_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tooth_cond_hist_patient
  ON tooth_condition_history (organization_id, patient_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_tooth_cond_hist_tooth
  ON tooth_condition_history (organization_id, patient_id, tooth_number, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_tooth_cond_hist_treatment
  ON tooth_condition_history (treatment_id)
  WHERE treatment_id IS NOT NULL;

-- Add source column to existing tooth_chart_history table.
-- DEFAULT 'manual' so all historical rows are correctly classified.
ALTER TABLE tooth_chart_history ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
