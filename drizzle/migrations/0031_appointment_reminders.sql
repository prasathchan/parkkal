-- migration 0031: appointment_reminders
--
-- Stores one row per scheduled notification (SMS, WhatsApp, Email).
-- The cron job at /api/cron/reminders queries this table every 15 minutes
-- and sends any PENDING reminders whose scheduled_at has passed.
--
-- REMINDER LIFECYCLE:
--   PENDING  → cron picks it up → sends → SENT
--   PENDING  → cron tries, delivery fails → FAILED (error_message set)
--   PENDING  → appointment cancelled → CANCELLED (cron skips CANCELLED rows)
--
-- Rows are never deleted — they form an audit trail of all notifications sent.

CREATE TABLE IF NOT EXISTS appointment_reminders (
  id              TEXT    PRIMARY KEY,
  organization_id TEXT    NOT NULL REFERENCES organizations(id),
  appointment_id  TEXT    NOT NULL REFERENCES appointments(id),
  patient_id      TEXT    NOT NULL REFERENCES patients(id),
  -- Delivery channel
  channel         TEXT    NOT NULL CHECK(channel IN ('SMS', 'WHATSAPP', 'EMAIL')),
  -- When to deliver (Unix ms). Cron picks up rows where scheduled_at <= NOW() AND status = 'PENDING'
  scheduled_at    INTEGER NOT NULL,
  sent_at         INTEGER,          -- set when status → SENT
  status          TEXT    NOT NULL DEFAULT 'PENDING'
                          CHECK(status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED')),
  error_message   TEXT,             -- set when status → FAILED
  -- The rendered message to deliver (pre-rendered at schedule time so renames don't affect it)
  message         TEXT    NOT NULL,
  -- Which timing slot this reminder represents (for deduplication on reschedule)
  reminder_type   TEXT    NOT NULL CHECK(reminder_type IN ('24H', '2H', '1H')),
  created_at      INTEGER NOT NULL
);

-- Primary query pattern: cron job fetching due reminders
CREATE INDEX IF NOT EXISTS idx_appt_reminders_cron
  ON appointment_reminders(status, scheduled_at)
  WHERE status = 'PENDING';

-- Supporting query: list reminders for one appointment (admin UI)
CREATE INDEX IF NOT EXISTS idx_appt_reminders_appt
  ON appointment_reminders(appointment_id);
