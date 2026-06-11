/**
 * lib/api.ts
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ROUTE UTILITIES — The backbone of every API handler in this app.       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ─── THE PROBLEM ─────────────────────────────────────────────────────────────
 * Before this file existed, every single API route had the same ~10 lines:
 *
 *   const session = await getSession(request);
 *   if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   const rl = await checkRateLimit(`write:${session.userId}`, WRITE_RATE_LIMIT);
 *   if (!rl.allowed) return NextResponse.json({ error: "Too many requests..." }, { status: 429 });
 *   const log = logger.forRoute("POST /api/patients", session);
 *   if (!await hasPermission(session, PERMISSIONS.PATIENTS_CREATE)) {
 *     log.security("Permission denied: patients.create", {});
 *     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 *   }
 *   try { ... } catch (error) {
 *     if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
 *     log.error("...", error);
 *     return NextResponse.json({ error: "Internal server error" }, { status: 500 });
 *   }
 *
 * 60 routes × ~10 lines = 600 lines of copy-paste.
 *
 * ─── THE SOLUTION ─────────────────────────────────────────────────────────────
 * `withRoute()` handles all of that in one place. Your route becomes:
 *
 *   export const POST = withRoute(
 *     { route: "POST /api/patients", permission: PERMISSIONS.PATIENTS_CREATE, rateLimit: RATE_LIMITS.WRITE },
 *     async (req, { session, db, log }) => {
 *       // ← only your business logic here, zero boilerplate
 *       return apiOk({ patient: {...} }, 201);
 *     }
 *   );
 *
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 *
 *   withRoute()   wrap a handler with auth + rate-limit + permissions + error handling
 *   apiOk()       return a JSON success response  { data... }  → 200 (or custom)
 *   apiError()    return a JSON error response    { error }    → specified status code
 *   RATE_LIMITS   pre-built rate limit configs so routes don't define their own constants
 *
 * ─── USAGE BY ROUTE TYPE ─────────────────────────────────────────────────────
 *
 *   // Route with NO path params (e.g. /api/patients)
 *   export const GET = withRoute(
 *     { route: "GET /api/patients", permission: PERMISSIONS.PATIENTS_VIEW },
 *     async (req, { session, db }) => { ... }
 *   );
 *
 *   // Route WITH path params (e.g. /api/patients/[id])
 *   export const DELETE = withRoute<{ id: string }>(
 *     { route: "DELETE /api/patients/[id]", adminOnly: true, rateLimit: RATE_LIMITS.DESTRUCTIVE },
 *     async (req, { session, db, log }, { id }) => { ... }
 *   );
 *
 *   // Route with IP-based rate limiting (e.g. login, OTP)
 *   export const POST = withRoute(
 *     {
 *       route: "POST /api/auth/login",
 *       rateLimit: RATE_LIMITS.LOGIN,
 *       rateLimitKey: (_, req) => `login:${getClientIp(req)}`,
 *     },
 *     async (req, { session, db }) => { ... }
 *   );
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { eq, and } from "drizzle-orm";
import { getSession, isTokenRevoked } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit";
import { logger, type RouteLogger } from "@/lib/logger";
import { getDb, type DbInstance } from "@/lib/db";
import { organizationMembers } from "@/db/schema";
import { writeAppLog } from "@/lib/app-logger";
import type { OrgSessionPayload } from "@/lib/auth-edge";

// ─── Body size limit ──────────────────────────────────────────────────────────
/**
 * Maximum JSON request body size enforced on every withRoute() handler.
 *
 * 512 KB comfortably fits any legitimate API payload in this app (the largest
 * being a treatment with consent notes + medical history). A malicious client
 * sending a 50 MB JSON body would otherwise force the Worker to parse it all
 * before Zod validation even runs — this check rejects it at the front door
 * using the Content-Length header, costing zero extra DB calls.
 *
 * Upload routes (attachments, consent documents) handle their own limits via
 * the custom rateLimit config and read the body as a stream, not JSON.
 */
export const MAX_JSON_BODY_BYTES = 512_000; // 512 KB

// ─── Response helpers ─────────────────────────────────────────────────────────

/**
 * Return a successful JSON response.
 *
 * @param data   The response payload — any JSON-serializable object
 * @param status HTTP status code — defaults to 200. Use 201 for "created".
 *
 * @example
 *   return apiOk({ patients: rows, total: 42 });
 *   return apiOk({ patient: newPatient }, 201);
 */
export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Return a JSON error response with a human-readable message.
 * Optionally include extra fields in the response body (e.g. visitId for 409 Conflict).
 *
 * @param message  What went wrong — shown to the API caller
 * @param status   HTTP status (401, 403, 404, 422, 429, 500, etc.)
 * @param extra    Optional extra fields merged into the response body
 *
 * @example
 *   return apiError("Patient not found", 404);
 *   return apiError("Visit already exists for this appointment", 409, { visitId: existing.id });
 */
export function apiError(
  message: string,
  status: number,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}

// ─── Rate limit presets ───────────────────────────────────────────────────────
/**
 * Pre-built rate limit configurations for common route categories.
 *
 * Use these instead of defining `const X_RATE_LIMIT = {...}` in each route file.
 * This means changing a limit requires editing ONE place instead of 25.
 *
 * Usage: pass as `rateLimit: RATE_LIMITS.WRITE` in withRoute() options.
 */
export const RATE_LIMITS = {
  /**
   * Standard write operations: create/edit patients, visits, appointments.
   * 120 requests per minute per user.
   */
  WRITE: { limit: 120, windowMs: 60_000 } as RateLimitConfig,

  /**
   * Admin-level write operations: member management, role changes, org settings.
   * 30 requests per minute per user — more restricted than regular writes.
   */
  ADMIN: { limit: 30, windowMs: 60_000 } as RateLimitConfig,

  /**
   * Destructive operations: deletes of patients, visits, treatments.
   * 10 per minute per user — prevents accidental or malicious bulk deletion.
   */
  DESTRUCTIVE: { limit: 10, windowMs: 60_000 } as RateLimitConfig,

  /**
   * Login attempts, keyed by IP address.
   * 10 per 15 minutes — guards against password brute-force attacks.
   */
  LOGIN: { limit: 10, windowMs: 15 * 60_000 } as RateLimitConfig,

  /**
   * OTP request attempts, keyed by IP address.
   * 10 per 10 minutes — prevents SMS/email bombing.
   */
  OTP: { limit: 10, windowMs: 10 * 60_000 } as RateLimitConfig,

  /**
   * Read operations for authenticated users.
   * 300 per minute per user — generous but still prevents runaway scrapers.
   */
  READ: { limit: 300, windowMs: 60_000 } as RateLimitConfig,
} as const;

// ─── Route context ────────────────────────────────────────────────────────────

/**
 * What your handler receives after all checks pass.
 * No more manual calls to getSession(), getDb(), or logger.forRoute().
 */
export interface RouteContext {
  /** The logged-in user's session — includes userId, orgId, role, permissions */
  session: OrgSessionPayload;
  /** Ready-to-use database instance (Drizzle ORM) */
  db: DbInstance;
  /** Structured logger pre-scoped to this route + user */
  log: RouteLogger;
}

// ─── withRoute configuration ──────────────────────────────────────────────────

interface RouteOptions {
  /**
   * A label like "POST /api/patients" — appears in every log line from this route.
   * Use the file path convention: "METHOD /api/path/[param]"
   */
  route: string;

  /**
   * The permission string from PERMISSIONS that the caller must have.
   * If omitted, any authenticated user can call this route.
   * Example: PERMISSIONS.PATIENTS_VIEW
   */
  permission?: Permission;

  /**
   * Rate limit to apply. Use one of the RATE_LIMITS presets.
   * Omit for GET routes that don't need rate limiting.
   */
  rateLimit?: RateLimitConfig;

  /**
   * Function that returns the rate limit "bucket key" for this request.
   * Default: `write:{userId}` — rate-limits per user.
   * Override for IP-based keying (login, OTP endpoints).
   *
   * @example
   *   // Rate-limit login by IP so different users share the same IP bucket
   *   rateLimitKey: (_, req) => `login:${getClientIp(req)}`
   */
  rateLimitKey?: (session: OrgSessionPayload, req: NextRequest) => string;

  /**
   * If true, only users with role === "ADMIN" can call this endpoint.
   * Use this for destructive operations that should never be delegated to staff.
   */
  adminOnly?: boolean;
}

// ─── withRoute ────────────────────────────────────────────────────────────────

/**
 * Wraps a route handler with all standard middleware in the correct order:
 *
 *   1. Authentication  — 401 if no valid session cookie
 *   2. Rate limiting   — 429 if over limit
 *   3. Authorization   — 403 if missing permission (or adminOnly route)
 *   4. Business logic  — your handler runs here
 *   5. Error handling  — 400 for ZodError, 500 for unknown errors
 *
 * ─── Type parameter P ────────────────────────────────────────────────────────
 * P is the URL path params shape. Examples:
 *   - Route with no params:  withRoute(...)           P = Record<string, string>
 *   - Route with { id }:     withRoute<{ id: string }>(...) P = { id: string }
 *   - Route with { userId }: withRoute<{ userId: string }>(...) etc.
 *
 * The resolved params are passed as the third argument to your handler.
 */
export function withRoute<P extends Record<string, string | string[]> = Record<string, string>>(
  options: RouteOptions,
  handler: (req: NextRequest, ctx: RouteContext, params: P) => Promise<NextResponse>
) {
  // This is the actual function that Next.js calls on every HTTP request
  return async (
    request: NextRequest,
    context: { params: Promise<P> }
  ): Promise<NextResponse> => {

    const requestStart = Date.now();

    // ── 0. Body size guard ─────────────────────────────────────────────────
    // Reject oversized request bodies before touching auth or the DB.
    // Content-Length is not mandatory (chunked transfer omits it), but when
    // present it's trustworthy enough to short-circuit early. Cloudflare's
    // edge enforces a hard 100 MB ceiling regardless.
    const rawContentLength = request.headers.get("content-length");
    if (rawContentLength !== null) {
      const bodyBytes = parseInt(rawContentLength, 10);
      if (!Number.isNaN(bodyBytes) && bodyBytes > MAX_JSON_BODY_BYTES) {
        return apiError("Request body too large", 413);
      }
    }

    // ── 1. Authentication ──────────────────────────────────────────────────
    // Every protected route requires a valid `pkd_org_session` cookie.
    const session = await getSession(request);
    if (!session) return apiError("Unauthorized", 401);

    // Set up a logger that tags every message with this route + user
    const log = logger.forRoute(options.route, session);

    // ── 1a–5. Auth checks + Business Logic + Error Handling ───────────────
    // The entire post-auth pipeline is wrapped in one try-catch so that any
    // unexpected throw (DB binding missing, Drizzle error, etc.) always
    // produces our structured JSON 500 — never a bare Next.js error page.
    try {
      // ── 1a. Token Revocation ─────────────────────────────────────────────
      if (session.jti && await isTokenRevoked(session.jti)) {
        log.security("Revoked token used", { jti: session.jti });
        writeAppLog({
          level: "security", route: options.route,
          message: "Revoked token used",
          organizationId: session.orgId, userId: session.userId, userRole: session.role,
          data: { jti: session.jti },
        });
        return apiError("Unauthorized", 401);
      }

      // ── 1b. Member Active Check ──────────────────────────────────────────
      // Reject requests from staff whose account has been deactivated in the org.
      // This catches the window between deactivation and token expiry (up to 24h).
      // ADMIN role bypasses this check — at least one admin must always work.
      if (session.role !== "ADMIN") {
        const memberDb = getDb();
        const [member] = await memberDb
          .select({ isActive: organizationMembers.isActive })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, session.orgId),
              eq(organizationMembers.userId, session.userId)
            )
          );
        if (!member || member.isActive === 0) {
          log.security("Deactivated member attempted access", {});
          writeAppLog({
            level: "security", route: options.route,
            message: "Deactivated member attempted access",
            organizationId: session.orgId, userId: session.userId, userRole: session.role,
          });
          return apiError("Your account has been deactivated. Please contact your administrator.", 403);
        }
      }

      // ── 2. Rate Limiting ─────────────────────────────────────────────────
      if (options.rateLimit) {
        const key = options.rateLimitKey
          ? options.rateLimitKey(session, request)
          : `write:${session.userId}`;
        const rl = await checkRateLimit(key, options.rateLimit);
        if (!rl.allowed) return apiError("Too many requests. Please slow down.", 429);
      }

      // ── 3. Authorization ─────────────────────────────────────────────────
      if (options.adminOnly && session.role !== "ADMIN") {
        log.security("Permission denied: admin-only route", { role: session.role });
        writeAppLog({
          level: "security", route: options.route,
          message: "Permission denied: admin-only route",
          organizationId: session.orgId, userId: session.userId, userRole: session.role,
        });
        return apiError("Forbidden", 403);
      }
      if (options.permission && !await hasPermission(session, options.permission)) {
        log.security(`Permission denied: ${options.permission}`, {});
        writeAppLog({
          level: "security", route: options.route,
          message: `Permission denied: ${options.permission}`,
          organizationId: session.orgId, userId: session.userId, userRole: session.role,
          data: { requiredPermission: options.permission },
        });
        return apiError("Forbidden", 403);
      }

      // ── 4. Business Logic ────────────────────────────────────────────────
      const db = getDb();
      const params = await context?.params ?? {} as P;
      const response = await handler(request, { session, db, log }, params);
      response.headers.set("X-Response-Time", `${Date.now() - requestStart}ms`);
      return response;

    } catch (error) {
      // Zod validation errors → 400 Bad Request with field-level details
      if (error instanceof ZodError) {
        return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
      }
      // Unexpected crash → log to structured console AND persist to D1 for admin viewer
      log.error("Unhandled route error", error);
      writeAppLog({
        level: "error", route: options.route,
        message: "Unhandled route error",
        error,
        organizationId: session.orgId, userId: session.userId, userRole: session.role,
      });
      return apiError("Internal server error", 500);
    }
  };
}
