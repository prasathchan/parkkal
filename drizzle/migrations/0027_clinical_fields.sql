-- Migration 0027: Clinical fields — referral source on patients, recall on visits
--
-- referralSource: tracks how the patient found the clinic (word-of-mouth, Google,
--   existing patient referral, etc.). Used for marketing ROI and patient retention.
--
-- recallDate / recallNotes: a future date the dentist recommends the patient return
--   (e.g. "6-month checkup"). Powers the Recalls view that shows overdue/upcoming recalls.

ALTER TABLE patients ADD COLUMN referral_source TEXT;

ALTER TABLE visits ADD COLUMN recall_date TEXT;       -- YYYY-MM-DD
ALTER TABLE visits ADD COLUMN recall_notes TEXT;

-- Index for the Recalls dashboard (filter upcoming recalls by org + date)
CREATE INDEX IF NOT EXISTS idx_visits_recall_date
  ON visits(organization_id, recall_date)
  WHERE recall_date IS NOT NULL;
