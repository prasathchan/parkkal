-- Enforce NOT NULL on organization_id for the five tables where the column
-- was originally created without a NOT NULL constraint.
--
-- SQLite does not support ALTER TABLE ... ALTER COLUMN to add NOT NULL to an
-- existing column, so we use BEFORE INSERT / BEFORE UPDATE triggers as
-- enforcement guards instead. The Drizzle schema already declares these
-- columns as notNull(), providing TypeScript-level safety; these triggers add
-- the same guarantee at the DB layer for any writes that bypass the ORM.

CREATE TRIGGER IF NOT EXISTS trg_appointments_org_id_not_null
BEFORE INSERT ON appointments
FOR EACH ROW
WHEN NEW.organization_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'organization_id must not be NULL on appointments');
END;

CREATE TRIGGER IF NOT EXISTS trg_appointments_org_id_not_null_upd
BEFORE UPDATE OF organization_id ON appointments
FOR EACH ROW
WHEN NEW.organization_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'organization_id must not be NULL on appointments');
END;

CREATE TRIGGER IF NOT EXISTS trg_treatments_org_id_not_null
BEFORE INSERT ON treatments
FOR EACH ROW
WHEN NEW.organization_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'organization_id must not be NULL on treatments');
END;

CREATE TRIGGER IF NOT EXISTS trg_treatments_org_id_not_null_upd
BEFORE UPDATE OF organization_id ON treatments
FOR EACH ROW
WHEN NEW.organization_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'organization_id must not be NULL on treatments');
END;

CREATE TRIGGER IF NOT EXISTS trg_visits_org_id_not_null
BEFORE INSERT ON visits
FOR EACH ROW
WHEN NEW.organization_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'organization_id must not be NULL on visits');
END;

CREATE TRIGGER IF NOT EXISTS trg_visits_org_id_not_null_upd
BEFORE UPDATE OF organization_id ON visits
FOR EACH ROW
WHEN NEW.organization_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'organization_id must not be NULL on visits');
END;

CREATE TRIGGER IF NOT EXISTS trg_invoices_org_id_not_null
BEFORE INSERT ON invoices
FOR EACH ROW
WHEN NEW.organization_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'organization_id must not be NULL on invoices');
END;

CREATE TRIGGER IF NOT EXISTS trg_invoices_org_id_not_null_upd
BEFORE UPDATE OF organization_id ON invoices
FOR EACH ROW
WHEN NEW.organization_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'organization_id must not be NULL on invoices');
END;

CREATE TRIGGER IF NOT EXISTS trg_prescriptions_org_id_not_null
BEFORE INSERT ON prescriptions
FOR EACH ROW
WHEN NEW.organization_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'organization_id must not be NULL on prescriptions');
END;

CREATE TRIGGER IF NOT EXISTS trg_prescriptions_org_id_not_null_upd
BEFORE UPDATE OF organization_id ON prescriptions
FOR EACH ROW
WHEN NEW.organization_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'organization_id must not be NULL on prescriptions');
END;
