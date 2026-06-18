-- 0059_backfill_default_location.sql
-- For every existing org, inserts one default "Main Branch" location,
-- a default location_settings row, and backfills location_id on all
-- existing visits and appointments to that default location.
--
-- NOTE: org.address is a JSON blob — we intentionally leave location.address NULL
-- so that admins can fill it in with a plain-text address via Settings → Locations.

INSERT INTO locations (id, organization_id, name, address, phone, timezone, is_active, is_default, created_at, updated_at)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
  id,
  'Main Branch',
  NULL,
  phone,
  COALESCE(timezone, 'Asia/Kolkata'),
  1,
  1,
  created_at,
  strftime('%s', 'now') * 1000
FROM organizations;

INSERT INTO location_settings (location_id, opening_time, closing_time, slot_duration_minutes, max_advance_booking_days, updated_at)
SELECT id, '09:00', '18:00', 30, 60, strftime('%s', 'now') * 1000
FROM locations WHERE is_default = 1;

UPDATE visits
SET location_id = (
  SELECT l.id FROM locations l
  WHERE l.organization_id = visits.organization_id AND l.is_default = 1
  LIMIT 1
)
WHERE location_id IS NULL;

UPDATE appointments
SET location_id = (
  SELECT l.id FROM locations l
  WHERE l.organization_id = appointments.organization_id AND l.is_default = 1
  LIMIT 1
)
WHERE location_id IS NULL;
