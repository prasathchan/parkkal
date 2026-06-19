-- Add HIPAA BAA acceptance columns to organizations
-- Tracks whether the clinic operator has signed a Business Associate Agreement,
-- which is required before Parkkal can store PHI on behalf of HIPAA-covered entities.
ALTER TABLE organizations ADD COLUMN baa_version TEXT;
ALTER TABLE organizations ADD COLUMN baa_accepted_at INTEGER;
ALTER TABLE organizations ADD COLUMN baa_accepted_by TEXT;
