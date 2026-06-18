-- Add GSTIN (GST registration number) to locations for multi-branch Indian clinics.
-- Each branch can have a different state-registered GSTIN for compliant invoicing.
ALTER TABLE locations ADD COLUMN gstin TEXT;
