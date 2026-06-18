-- 0055_locations.sql
-- Creates the locations (branches) table for multi-branch support.
-- Each org gets a default location auto-created in migration 0059.

CREATE TABLE IF NOT EXISTS locations (
  id              TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name            TEXT NOT NULL,
  address         TEXT,
  phone           TEXT,
  timezone        TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  is_active       INTEGER NOT NULL DEFAULT 1,
  is_default      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(organization_id);
