-- 0058_location_settings.sql
-- Per-branch calendar configuration.

CREATE TABLE IF NOT EXISTS location_settings (
  location_id              TEXT PRIMARY KEY NOT NULL REFERENCES locations(id),
  opening_time             TEXT NOT NULL DEFAULT '09:00',
  closing_time             TEXT NOT NULL DEFAULT '18:00',
  slot_duration_minutes    INTEGER NOT NULL DEFAULT 30,
  max_advance_booking_days INTEGER NOT NULL DEFAULT 60,
  updated_at               INTEGER NOT NULL
);
