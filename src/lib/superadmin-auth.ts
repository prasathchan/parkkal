/**
 * lib/superadmin-auth.ts
 *
 * Second-factor authentication for superadmin routes.
 *
 * A compromised org-level JWT must not give global access to every clinic's data.
 * Superadmin actions require a SEPARATE short-lived token signed with SUPERADMIN_SECRET
 * (a different key from JWT_SECRET). This token is obtained by calling
 * POST /api/superadmin/auth and must be sent as X-Superadmin-Token on every request.
 *
 * Flow:
 *   1. Superadmin logs in normally (org session cookie).
 *   2. Calls POST /api/superadmin/auth — verified as isSuperAdmin in DB + has org session.
 *   3. Receives a 1-hour superadmin token in the response body.
 *   4. Includes `X-Superadmin-Token: <token>` on all /api/superadmin/* requests.
 *   5. requireSuperadminToken() validates both the org session and this second token.
 *
 * All superadmin actions are written to the superadmin_actions append-only audit table.
 */

import { SignJWT, jwtVerify } from "jose";
import env from "@/lib/env";

const AUD = "pkd:superadmin";
const TTL = "1h";

function getSecret(): Uint8Array {
  if (!env.SUPERADMIN_SECRET) throw new Error("SUPERADMIN_SECRET is not configured");
  return new TextEncoder().encode(env.SUPERADMIN_SECRET);
}

export interface SuperadminTokenPayload {
  userId: string;
}

/** Issue a 1-hour superadmin session token. Call only after confirming isSuperAdmin. */
export async function createSuperadminToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(getSecret());
}

/** Verify a superadmin session token. Returns the payload or null. */
export async function verifySuperadminToken(
  token: string
): Promise<SuperadminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { audience: AUD });
    return payload as unknown as SuperadminTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Extract and verify the X-Superadmin-Token header from a request.
 * Returns the payload if valid, null otherwise.
 * Also returns null (and does not throw) when SUPERADMIN_SECRET is not configured.
 */
export async function requireSuperadminToken(
  request: Request,
  expectedUserId: string
): Promise<boolean> {
  if (!env.SUPERADMIN_SECRET) return false;
  const token = request.headers.get("X-Superadmin-Token");
  if (!token) return false;
  const payload = await verifySuperadminToken(token);
  if (!payload) return false;
  return payload.userId === expectedUserId;
}

/** Write a row to the superadmin_actions append-only audit table. */
export async function logSuperadminAction(
  actorId: string,
  action: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    const db = ctx?.env?.DB as D1Database | null;
    if (!db) return;
    await db
      .prepare(
        "INSERT INTO superadmin_actions (id, actor_id, action, data, created_at) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(
        crypto.randomUUID(),
        actorId,
        action,
        data ? JSON.stringify(data) : null,
        Date.now()
      )
      .run();
  } catch (e) {
    console.error("[superadmin] Failed to log action:", e);
  }
}
