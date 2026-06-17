-- Staff professional profiles
-- One row per user; stores qualifications, registrations, and credential documents.

CREATE TABLE IF NOT EXISTS staff_profiles (
  user_id              TEXT PRIMARY KEY REFERENCES users(id),
  bio                  TEXT,
  specialization       TEXT,
  years_experience     INTEGER,
  languages            TEXT NOT NULL DEFAULT '[]',
  qualifications       TEXT NOT NULL DEFAULT '[]',
  ida_number           TEXT,
  dci_number           TEXT,
  state_council_number TEXT,
  license_expiry       TEXT,
  previous_employer    TEXT,
  documents            TEXT NOT NULL DEFAULT '[]',
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);
