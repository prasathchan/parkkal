-- patient_access_log: records every READ of a patient record for DPDP Act compliance.
-- This is a read-access audit trail — distinct from admin_audit_log which tracks mutations.
-- Fire-and-forget writes; indexed for per-patient and per-actor queries.
CREATE TABLE IF NOT EXISTS patient_access_log (
  id             TEXT    NOT NULL PRIMARY KEY,
  organization_id TEXT   NOT NULL,
  actor_id        TEXT   NOT NULL,
  patient_id      TEXT   NOT NULL,
  access_type     TEXT   NOT NULL, -- PROFILE | VISIT | TREATMENT | PRESCRIPTION | ATTACHMENT | BILLING | CHART
  route           TEXT   NOT NULL,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pal_org_patient ON patient_access_log(organization_id, patient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pal_org_actor   ON patient_access_log(organization_id, actor_id,  created_at);
