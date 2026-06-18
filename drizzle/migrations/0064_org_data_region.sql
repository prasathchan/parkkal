-- Migration 0064: add data_region to organizations
-- Informational field for DPDP compliance: documents where data is acknowledged to reside.
-- D1 data is globally replicated by default; this is a disclosure field, not an enforcement control.

ALTER TABLE organizations ADD COLUMN data_region TEXT NOT NULL DEFAULT 'global';
