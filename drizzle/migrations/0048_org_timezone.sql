-- migration 0048: org timezone
--
-- Adds a timezone column to organizations so the clinic's local time is
-- used consistently across reminder scheduling, reports, and date display.
--
-- Default: 'Asia/Kolkata' (IST, UTC+5:30) — the only timezone in use today.
-- Value must be a valid IANA timezone identifier (e.g. "Asia/Kolkata",
-- "America/New_York"). Validated at the API layer, not enforced in SQLite.

ALTER TABLE organizations ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
