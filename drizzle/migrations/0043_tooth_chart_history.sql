-- Migration: 0043_tooth_chart_history.sql
-- Full snapshot of the tooth chart at each save, linked to the visit that
-- triggered the change. visit_id is nullable — edits from the patient page
-- (outside any visit) are still tracked.

CREATE TABLE IF NOT EXISTS tooth_chart_history (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  patient_id      TEXT NOT NULL REFERENCES patients(id),
  visit_id        TEXT REFERENCES visits(id),
  tooth_data      TEXT NOT NULL,
  changed_teeth   TEXT NOT NULL DEFAULT '[]',
  recorded_by     TEXT NOT NULL REFERENCES users(id),
  recorded_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tooth_chart_history_patient
  ON tooth_chart_history(organization_id, patient_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_tooth_chart_history_visit
  ON tooth_chart_history(visit_id);
