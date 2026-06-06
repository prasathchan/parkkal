-- Index on verification_tokens.code for fast OTP lookups.
-- Without this, every OTP verify scans the full table.
CREATE INDEX IF NOT EXISTS idx_verification_tokens_code ON verification_tokens(code);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_type ON verification_tokens(user_id, type, used);
