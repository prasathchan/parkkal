-- Migration: 0047_org_drugs
-- Clinic-curated drug formulary for prescription autocomplete

CREATE TABLE IF NOT EXISTS org_drugs (
  id             TEXT    PRIMARY KEY NOT NULL,
  organization_id TEXT   NOT NULL REFERENCES organizations(id),
  name           TEXT    NOT NULL,
  default_dosage    TEXT,
  default_frequency TEXT,
  default_duration  TEXT,
  created_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS org_drugs_org_idx ON org_drugs(organization_id);
