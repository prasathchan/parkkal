/**
 * lib/auth-edge.ts
 *
 * JWT creation and verification — safe to run in Edge Runtime (no Node.js APIs).
 * This is the lowest-level auth file; all other auth code imports from here.
 *
 * ─── TWO TOKEN TYPES ─────────────────────────────────────────────────────────
 *
 *   pkd_session     (JWTPayload)        Issued right after login, before the user
 *                                       picks an organisation. Short-lived (1 hour).
 *                                       Cookie name: pkd_session
 *
 *   pkd_org_session (OrgSessionPayload) Issued after the user picks an org.
 *                                       Contains orgId, role, permissions, and a
 *                                       unique jti for revocation. Long-lived (24h).
 *                                       Cookie name: pkd_org_session
 *
 * ─── AUDIENCE SEPARATION ─────────────────────────────────────────────────────
 * Each token type has a different `aud` claim (pkd:pre-org / pkd:org).
 * jose rejects a token if its audience doesn't match — so a pre-org token can
 * never be accepted where an org session token is expected.
 *
 * ─── TOKEN REVOCATION ────────────────────────────────────────────────────────
 * Every org session token carries a `jti` (JWT ID) — a UUID generated at mint time.
 * On logout (or admin revocation), the jti is written to the revoked_tokens D1 table.
 * withRoute() calls isTokenRevoked(jti) before allowing the request through.
 * Revoked rows expire automatically once their expires_at passes.
 *
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 *
 *   createToken(payload)         → signed JWT for pre-org session (1h)
 *   createOrgToken(payload)      → signed JWT for org session (24h), includes jti
 *   verifyToken(token)           → decoded JWTPayload or null
 *   verifyOrgToken(token)        → decoded OrgSessionPayload or null
 *   getSession(request)          → read + verify pkd_org_session cookie
 *   getPreOrgSession(request)    → read + verify pkd_session cookie
 *   revokeToken(jti, expiresAt)  → write jti to revocation list in D1
 *   isTokenRevoked(jti)          → true if jti has been revoked
 */
import { SignJWT, jwtVerify } from "jose";

// ─── JWT Secret ───────────────────────────────────────────────────────────────

// Resolve the signing secret lazily so the "not set" warning fires at runtime
// (first token operation) rather than at module load / build time.
let cachedSecret: Uint8Array | null = null;
let warned = false;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  if (!process.env.JWT_SECRET) {
    if (!warned) {
      warned = true;
      console.error("[SECURITY] JWT_SECRET env var is not set. Using insecure default — DO NOT use in production.");
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production");
    }
  }
  cachedSecret = new TextEncoder().encode(
    process.env.JWT_SECRET || "parkkal-dental-secret-key-change-in-production"
  );
  return cachedSecret;
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
}

export interface OrgSessionPayload {
  userId: string;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: string;
  orgRoleId?: string | null;
  /**
   * Permission strings embedded at login time to avoid a DB round-trip on every
   * permission check. Absent on tokens issued before this field was added —
   * hasPermission() falls back to a DB lookup in that case.
   */
  permissions?: string[] | null;
  /**
   * JWT ID — unique UUID per token, used for revocation.
   * Write this jti to revoked_tokens to invalidate the token before its natural expiry.
   */
  jti?: string;
}

// ─── Audience constants ───────────────────────────────────────────────────────
// Prevents a pre-org JWT from being accepted where an org session token is expected.
const AUD_PRE_ORG = "pkd:pre-org";
const AUD_ORG = "pkd:org";

// ─── Token creation ───────────────────────────────────────────────────────────

/** Create a short-lived pre-org session token (1h). No jti — not revocable. */
export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUD_PRE_ORG)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret());
}

/**
 * Create an org session token (24h).
 * A unique jti is generated and embedded so the token can be revoked via revokeToken().
 */
export async function createOrgToken(payload: OrgSessionPayload): Promise<string> {
  const jti = crypto.randomUUID();
  return new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUD_ORG)
    .setIssuedAt()
    .setExpirationTime("24h")
    .setJti(jti)
    .sign(getSecret());
}

// ─── Token verification ───────────────────────────────────────────────────────

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { audience: AUD_PRE_ORG });
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function verifyOrgToken(token: string): Promise<OrgSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { audience: AUD_ORG });
    return payload as unknown as OrgSessionPayload;
  } catch {
    return null;
  }
}

// ─── Session helpers ──────────────────────────────────────────────────────────

/** Read and verify the pkd_org_session cookie from a request. */
export async function getSession(request: Request): Promise<OrgSessionPayload | null> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(/pkd_org_session=([^;]+)/);
  if (!match) return null;
  return verifyOrgToken(match[1]);
}

/** Read and verify the pkd_session (pre-org) cookie from a request. */
export async function getPreOrgSession(request: Request): Promise<JWTPayload | null> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(/pkd_session=([^;]+)/);
  if (!match) return null;
  return verifyToken(match[1]);
}

// ─── Token revocation ─────────────────────────────────────────────────────────

/**
 * Attempt to get a D1 database binding.
 * Returns null in local dev where the D1 binding is unavailable.
 */
async function getD1(): Promise<D1Database | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    return (ctx?.env?.DB as D1Database) ?? null;
  } catch {
    return null;
  }
}

/**
 * Revoke a token by writing its jti to the revoked_tokens table.
 * Call this on logout or when an admin deactivates a staff member.
 *
 * @param jti       The jti claim from the token to revoke
 * @param expiresAt Unix ms timestamp of when the token naturally expires
 *
 * @example
 *   // In logout route:
 *   const session = await getSession(request);
 *   if (session?.jti) await revokeToken(session.jti, Date.now() + 24 * 3600_000);
 */
export async function revokeToken(jti: string, expiresAt: number): Promise<void> {
  try {
    const db = await getD1();
    if (!db) return; // local dev — no revocation
    await db
      .prepare("INSERT OR IGNORE INTO revoked_tokens (jti, expires_at, revoked_at) VALUES (?, ?, ?)")
      .bind(jti, expiresAt, Date.now())
      .run();
  } catch (e) {
    // Revocation failure must never block the caller (e.g. logout must still clear cookies)
    console.error("[auth] Failed to revoke token:", e);
  }
}

/**
 * Returns true if the given jti has been explicitly revoked.
 * Returns false if D1 is unavailable (local dev) — fail open for developer experience.
 *
 * @example
 *   if (session.jti && await isTokenRevoked(session.jti)) return apiError("Unauthorized", 401);
 */
export async function isTokenRevoked(jti: string): Promise<boolean> {
  try {
    const db = await getD1();
    if (!db) return false; // local dev — no revocation store
    const row = await db
      .prepare("SELECT 1 FROM revoked_tokens WHERE jti = ? AND expires_at > ?")
      .bind(jti, Date.now())
      .first();
    return row !== null;
  } catch {
    return false; // fail open — better a stale token than a broken app
  }
}
