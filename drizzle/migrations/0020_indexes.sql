-- Missing indexes for columns added in migrations 0017–0019.

-- payments.treatment_id: used in GET /api/treatments/[id]/visits financial summary
-- and in the visit-detail payments join.
CREATE INDEX IF NOT EXISTS idx_payments_treatment ON payments(treatment_id);

-- consent_audit_log: lookup by treatmentId (used in cascade deletes and audit queries).
CREATE INDEX IF NOT EXISTS idx_consent_audit_treatment ON consent_audit_log(treatment_id);
