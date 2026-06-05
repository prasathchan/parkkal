-- SQLite does not support ALTER TABLE ADD CHECK CONSTRAINT.
-- Triggers are the idiomatic equivalent for adding value constraints to existing columns.

-- ── treatments.status ────────────────────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_treatments_status_insert
BEFORE INSERT ON treatments
BEGIN
  SELECT RAISE(ABORT, 'treatments.status must be PLANNED, IN_PROGRESS, or COMPLETED')
  WHERE NEW.status NOT IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED');
END;

CREATE TRIGGER IF NOT EXISTS trg_treatments_status_update
BEFORE UPDATE OF status ON treatments
BEGIN
  SELECT RAISE(ABORT, 'treatments.status must be PLANNED, IN_PROGRESS, or COMPLETED')
  WHERE NEW.status NOT IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED');
END;

-- ── treatments.consent_status ────────────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_treatments_consent_status_insert
BEFORE INSERT ON treatments
BEGIN
  SELECT RAISE(ABORT, 'treatments.consent_status must be PENDING, UPLOADED, VERIFIED, REJECTED, or EMERGENCY_OVERRIDE')
  WHERE NEW.consent_status NOT IN ('PENDING', 'UPLOADED', 'VERIFIED', 'REJECTED', 'EMERGENCY_OVERRIDE');
END;

CREATE TRIGGER IF NOT EXISTS trg_treatments_consent_status_update
BEFORE UPDATE OF consent_status ON treatments
BEGIN
  SELECT RAISE(ABORT, 'treatments.consent_status must be PENDING, UPLOADED, VERIFIED, REJECTED, or EMERGENCY_OVERRIDE')
  WHERE NEW.consent_status NOT IN ('PENDING', 'UPLOADED', 'VERIFIED', 'REJECTED', 'EMERGENCY_OVERRIDE');
END;

-- ── verification_tokens.type ─────────────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_verification_tokens_type_insert
BEFORE INSERT ON verification_tokens
BEGIN
  SELECT RAISE(ABORT, 'verification_tokens.type must be EMAIL, PHONE, STAFF_INVITE, or PHONE_OTP')
  WHERE NEW.type NOT IN ('EMAIL', 'PHONE', 'STAFF_INVITE', 'PHONE_OTP');
END;

-- ── feature_flags unique (feature_key, org_id) ───────────────────────────────
-- org_id is nullable (NULL = global flag). COALESCE maps NULL → '' so the
-- unique index treats (key, NULL) as a single allowed entry per feature key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_flags_key_org
ON feature_flags(feature_key, COALESCE(org_id, ''));
