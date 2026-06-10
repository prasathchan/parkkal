-- Migration: 0034_gst_invoicing.sql
-- Adds India GST fields to organizations and invoices tables.

-- organizations: GSTIN + GST registration flag + state code
ALTER TABLE organizations ADD COLUMN gstin TEXT;
ALTER TABLE organizations ADD COLUMN gst_registered INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN gst_state_code TEXT;

-- invoices: full GST breakdown fields
ALTER TABLE invoices ADD COLUMN gst_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN is_inter_state INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN taxable_amount REAL;
ALTER TABLE invoices ADD COLUMN cgst_rate REAL NOT NULL DEFAULT 9;
ALTER TABLE invoices ADD COLUMN sgst_rate REAL NOT NULL DEFAULT 9;
ALTER TABLE invoices ADD COLUMN igst_rate REAL NOT NULL DEFAULT 18;
ALTER TABLE invoices ADD COLUMN cgst_amount REAL;
ALTER TABLE invoices ADD COLUMN sgst_amount REAL;
ALTER TABLE invoices ADD COLUMN igst_amount REAL;
ALTER TABLE invoices ADD COLUMN sac_code TEXT NOT NULL DEFAULT '999312';
