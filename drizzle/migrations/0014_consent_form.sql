-- Consent form fields on treatments
ALTER TABLE treatments ADD COLUMN consent_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE treatments ADD COLUMN consent_document_url TEXT;
ALTER TABLE treatments ADD COLUMN consent_document_name TEXT;
ALTER TABLE treatments ADD COLUMN consent_uploaded_at INTEGER;
ALTER TABLE treatments ADD COLUMN consent_verified_at INTEGER;
ALTER TABLE treatments ADD COLUMN consent_notes TEXT;
ALTER TABLE treatments ADD COLUMN emergency_override INTEGER NOT NULL DEFAULT 0;
ALTER TABLE treatments ADD COLUMN emergency_reason TEXT;

-- Index for quick consent-pending lookups
CREATE INDEX IF NOT EXISTS idx_treatments_consent_status ON treatments(organization_id, consent_status);
