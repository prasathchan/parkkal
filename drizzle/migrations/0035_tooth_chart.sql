-- Migration: 0035_tooth_chart.sql
-- Creates the tooth_chart table — one row per patient per organisation.

CREATE TABLE IF NOT EXISTS tooth_chart (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  patient_id      TEXT NOT NULL REFERENCES patients(id),
  tooth_data      TEXT NOT NULL DEFAULT '{}',
  updated_at      INTEGER NOT NULL,
  updated_by      TEXT NOT NULL REFERENCES users(id),
  UNIQUE(organization_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_tooth_chart_org_patient
  ON tooth_chart(organization_id, patient_id);
