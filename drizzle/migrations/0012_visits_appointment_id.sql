-- Add appointment_id column to visits (was in schema but missing from migrations)
ALTER TABLE visits ADD COLUMN appointment_id TEXT REFERENCES appointments(id);
