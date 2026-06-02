-- Add visit_type column to visits table (was in schema but missing from migrations)
ALTER TABLE visits ADD COLUMN visit_type TEXT NOT NULL DEFAULT 'WALKIN' CHECK(visit_type IN ('APPOINTMENT','WALKIN'));

-- Create prescriptions table (was in schema but missing from migrations)
CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id),
  visit_id TEXT NOT NULL REFERENCES visits(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  doctor_id TEXT NOT NULL REFERENCES users(id),
  medicines TEXT NOT NULL,
  instructions TEXT,
  created_at INTEGER NOT NULL
);

-- Create feature_flags table (was in schema but missing from migrations)
CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  feature_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  org_id TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  rollout_percent INTEGER NOT NULL DEFAULT 100,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
