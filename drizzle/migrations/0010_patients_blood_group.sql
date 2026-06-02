-- Add blood_group column to patients (was in schema but missing from migrations)
ALTER TABLE patients ADD COLUMN blood_group TEXT;
