-- 0056_location_fks.sql
-- Adds nullable location_id FK to visits and appointments.
-- Existing rows will have NULL; migration 0059 backfills them.

ALTER TABLE visits ADD COLUMN location_id TEXT REFERENCES locations(id);
ALTER TABLE appointments ADD COLUMN location_id TEXT REFERENCES locations(id);

CREATE INDEX IF NOT EXISTS idx_visits_location ON visits(location_id);
CREATE INDEX IF NOT EXISTS idx_appointments_location ON appointments(location_id);
