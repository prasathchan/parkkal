/**
 * lib/otp.ts
 *
 * Hashing helpers for short-lived OTP codes stored in verification_tokens.
 *
 * WHY HASH OTPs?
 *   A DB dump would expose all pending 6-digit OTPs in plaintext, letting an
 *   attacker bypass 2FA/phone verification for every pending user.  Hashing
 *   with bcrypt means the attacker still has to brute-force each code — and
 *   while the keyspace is only 10^6, bcrypt cost 10 adds ~100ms per guess,
 *   making a full sweep take ~100,000 seconds per code.  Combined with the
 *   15-minute expiry window, the attack is practically infeasible.
 *
 * COST FACTOR:
 *   10 (not 12 like passwords).  OTP verification happens on every login, so
 *   we keep it fast enough for good UX (~100ms) while still being expensive
 *   for brute-force.
 *
 * LOOKUP PATTERN:
 *   Because bcrypt hashes are non-deterministic (random salt), we can no longer
 *   look up tokens with WHERE code = ?.  Instead callers must:
 *     1. Fetch the latest unused, unexpired token for userId + type.
 *     2. Call verifyOTP(submittedCode, storedHash).
 *   The resend flow already invalidates old tokens, so there is normally only
 *   one candidate per (userId, type) pair at verification time.
 */
import bcrypt from "bcryptjs";

const OTP_COST = 10;

/** Hash a plaintext OTP code for safe storage. */
export async function hashOTP(code: string): Promise<string> {
  return bcrypt.hash(code, OTP_COST);
}

/**
 * Compare a submitted OTP code against a stored bcrypt hash.
 * Returns false instead of throwing on any comparison error.
 */
export async function verifyOTP(code: string, storedHash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(code, storedHash);
  } catch {
    return false;
  }
}
