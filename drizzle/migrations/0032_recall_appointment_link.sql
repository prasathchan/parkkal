-- migration 0032: link recall to a booked appointment
--
-- Adds recall_appointment_id to visits so the Recalls dashboard knows
-- whether a recall has already been converted into a booked appointment.
--
-- RECALL STATUS (computed, not stored):
--   recall_date IS NULL                          → no recall set
--   recall_date IS NOT NULL AND recall_appointment_id IS NULL
--     AND recall_date >= TODAY                   → UNSCHEDULED (upcoming)
--     AND recall_date <  TODAY                   → LAPSED (overdue, not booked)
--   recall_appointment_id IS NOT NULL
--     AND appointment.status NOT IN ('COMPLETED','CANCELLED') → SCHEDULED
--     AND appointment.status = 'COMPLETED'                    → FULFILLED
--     AND appointment.status = 'CANCELLED'                    → LAPSED (re-surface)

ALTER TABLE visits ADD COLUMN recall_appointment_id TEXT REFERENCES appointments(id);

CREATE INDEX IF NOT EXISTS idx_visits_recall_appt
  ON visits(recall_appointment_id)
  WHERE recall_appointment_id IS NOT NULL;
