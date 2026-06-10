-- migration 0033: calendar_integrations
--
-- Stores OAuth tokens for staff who have connected their personal
-- Google Calendar or Outlook account. When an appointment is created
-- or updated, the clinic's system pushes the event to the doctor's
-- personal calendar so they always stay in sync.
--
-- TOKENS ARE STORED ENCRYPTED using the same AES-256-GCM key as PII fields.
-- Never store raw access/refresh tokens.
--
-- LIFECYCLE:
--   1. Staff clicks "Connect Google Calendar" in Settings
--   2. OAuth flow completes → row inserted here
--   3. On appointment create/update/cancel → calendar-sync.ts reads this row
--      and pushes/updates/deletes the event on the external calendar
--   4. Staff can disconnect at any time → is_active = 0 (row kept for audit)

CREATE TABLE IF NOT EXISTS calendar_integrations (
  id               TEXT    PRIMARY KEY,
  organization_id  TEXT    NOT NULL REFERENCES organizations(id),
  user_id          TEXT    NOT NULL REFERENCES users(id),
  -- 'GOOGLE' or 'OUTLOOK'
  provider         TEXT    NOT NULL CHECK(provider IN ('GOOGLE', 'OUTLOOK')),
  -- Encrypted OAuth tokens (AES-256-GCM via lib/encryption.ts)
  access_token     TEXT    NOT NULL,
  refresh_token    TEXT    NOT NULL,
  expires_at       INTEGER NOT NULL,  -- Unix ms when access_token expires
  -- External calendar ID to write events to (null = primary calendar)
  calendar_id      TEXT,
  -- External event IDs keyed by our appointment ID, stored as JSON map:
  -- e.g. {"appt_abc": "google_event_xyz", "appt_def": "google_event_uvw"}
  event_id_map     TEXT    NOT NULL DEFAULT '{}',
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_cal_integrations_user
  ON calendar_integrations(user_id, is_active);
