-- Atomic double-booking prevention for appointments.
--
-- SQLite does not support partial/filtered unique indexes, so we use BEFORE
-- triggers instead. A trigger runs inside the same implicit transaction as the
-- INSERT/UPDATE statement, making the check-then-write atomic — eliminating
-- the read-then-write race condition present in the application-layer check.
--
-- The sentinel error string 'SLOT_TAKEN' is caught by the API layer and
-- converted into a 409 response with a user-friendly message.

CREATE TRIGGER IF NOT EXISTS trg_appt_no_double_book_insert
BEFORE INSERT ON appointments
FOR EACH ROW
WHEN NEW.status NOT IN ('CANCELLED', 'NO_SHOW')
BEGIN
  SELECT RAISE(ABORT, 'SLOT_TAKEN')
  WHERE EXISTS (
    SELECT 1 FROM appointments
    WHERE organization_id  = NEW.organization_id
      AND doctor_id        = NEW.doctor_id
      AND appointment_date = NEW.appointment_date
      AND appointment_time = NEW.appointment_time
      AND status NOT IN ('CANCELLED', 'NO_SHOW')
      AND id != NEW.id
  );
END;

-- Fire only when a cancelled/no-show appointment is being reactivated so that
-- ordinary status progressions (SCHEDULED → IN_PROGRESS → COMPLETED) are not
-- rechecked unnecessarily.
CREATE TRIGGER IF NOT EXISTS trg_appt_no_double_book_update
BEFORE UPDATE OF status ON appointments
FOR EACH ROW
WHEN OLD.status IN ('CANCELLED', 'NO_SHOW')
  AND NEW.status NOT IN ('CANCELLED', 'NO_SHOW')
BEGIN
  SELECT RAISE(ABORT, 'SLOT_TAKEN')
  WHERE EXISTS (
    SELECT 1 FROM appointments
    WHERE organization_id  = NEW.organization_id
      AND doctor_id        = NEW.doctor_id
      AND appointment_date = NEW.appointment_date
      AND appointment_time = NEW.appointment_time
      AND status NOT IN ('CANCELLED', 'NO_SHOW')
      AND id != OLD.id
  );
END;
