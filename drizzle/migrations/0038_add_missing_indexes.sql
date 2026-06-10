-- Speeds up the cron job that polls for pending reminders
CREATE INDEX IF NOT EXISTS idx_reminders_pending ON appointment_reminders(status, scheduled_at);

-- App logs filtered by org and sorted by time
CREATE INDEX IF NOT EXISTS idx_app_logs_org_time ON app_logs(organization_id, created_at);

-- Token cleanup: delete expired tokens
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);

-- Consent audit lookups by treatment
CREATE INDEX IF NOT EXISTS idx_consent_audit_treatment ON consent_audit_log(treatment_id);

-- Calendar integration lookups
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_user_org ON calendar_integrations(user_id, organization_id);
