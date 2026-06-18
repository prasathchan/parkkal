-- Migration 0063: add severity + row_hash columns to admin_audit_log
-- These support the Phase 5 tamper-detection hash chain.
-- row_hash is nullable so existing rows are unaffected; new rows get a hash on insert.

ALTER TABLE admin_audit_log ADD COLUMN severity TEXT NOT NULL DEFAULT 'INFO';
ALTER TABLE admin_audit_log ADD COLUMN row_hash TEXT;
