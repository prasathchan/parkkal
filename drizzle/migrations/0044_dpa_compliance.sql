-- 0044_dpa_compliance.sql
-- DPDP Act 2023 / HIPAA compliance: patient data consent + organisation DPA tracking

-- Patient: record when & from where they gave data processing consent
ALTER TABLE patients ADD COLUMN data_consent_at INTEGER;
ALTER TABLE patients ADD COLUMN data_consent_ip TEXT;

-- Organisation: track DPA version accepted by the clinic admin
ALTER TABLE organizations ADD COLUMN dpa_version TEXT;
ALTER TABLE organizations ADD COLUMN dpa_accepted_at INTEGER;
ALTER TABLE organizations ADD COLUMN dpa_accepted_by TEXT;

-- Organisation: how many years patient records must be retained (default 7 per DPDP Act)
ALTER TABLE organizations ADD COLUMN data_retention_years INTEGER NOT NULL DEFAULT 7;
