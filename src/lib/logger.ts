/**
 * lib/logger.ts
 *
 * Structured logger for all server-side code.
 *
 * WHY THIS EXISTS:
 *   Plain console.error("Create patient error:", err) is useless in production.
 *   You can't filter by org, user, or route. You can't tell if it's a DB error
 *   or a validation error. You can't correlate a user complaint to a specific log.
 *
 *   This logger outputs structured JSON in production so Cloudflare's log tail
 *   and any log aggregator (Axiom, Datadog, etc.) can filter/search properly.
 *   In development it outputs human-readable lines.
 *
 * HOW TO USE:
 *
 *   // Top of your API route:
 *   const log = logger.forRoute("POST /api/patients");
 *
 *   // With session context (adds orgId, userId, role to every log):
 *   const log = logger.forRoute("POST /api/patients", session);
 *
 *   // Log levels:
 *   log.info("Patient created", { patientId: "abc123" });
 *   log.warn("Unusual input detected", { field: "phone", value: "..." });
 *   log.error("DB insert failed", error, { patientId: "abc123" });
 *   log.security("Permission denied", { requiredPermission: "patients.edit" });
 *
 * WHAT GETS REDACTED AUTOMATICALLY:
 *   - password, passwordHash, panNumber, aadhaarNumber, code (OTP), token
 *   - Any key containing "secret", "key", or "hash"
 */

// ─── Types ────────────────────────────────────────────────────────────────────

type LogLevel = "debug" | "info" | "warn" | "error" | "security";

interface LogContext {
  /** Route and method, e.g. "POST /api/patients" */
  route: string;
  /** Current user's ID — never log the user's personal data, just the ID */
  userId?: string;
  /** Current org's ID */
  orgId?: string;
  /** User's role, e.g. "DOCTOR" */
  role?: string;
}

interface LogEntry {
  level: LogLevel;
  route: string;
  message: string;
  timestamp: string;
  userId?: string;
  orgId?: string;
  role?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  data?: Record<string, unknown>;
}

// ─── Redaction ────────────────────────────────────────────────────────────────

/**
 * Keys whose values must NEVER appear in logs.
 * Add to this list if you add new sensitive fields.
 */
const REDACTED_KEYS = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "panNumber",
  "pan_number",
  "aadhaarNumber",
  "aadhaar_number",
  "code",          // OTP codes
  "token",
  "secret",
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
]);

function redact(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lower = key.toLowerCase();
    if (
      REDACTED_KEYS.has(key) ||
      lower.includes("secret") ||
      lower.includes("hash") ||
      lower.includes("key")
    ) {
      result[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redact(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── Output ───────────────────────────────────────────────────────────────────

function emit(entry: LogEntry): void {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    // Human-readable format for local development
    const prefix = `[${entry.level.toUpperCase()}] ${entry.route}`;
    const context = [entry.userId && `user:${entry.userId}`, entry.orgId && `org:${entry.orgId}`]
      .filter(Boolean)
      .join(" ");
    const suffix = context ? ` (${context})` : "";

    if (entry.level === "error" || entry.level === "security") {
      console.error(`${prefix}${suffix} — ${entry.message}`, entry.error ?? "", entry.data ?? "");
    } else if (entry.level === "warn") {
      console.warn(`${prefix}${suffix} — ${entry.message}`, entry.data ?? "");
    } else {
      console.log(`${prefix}${suffix} — ${entry.message}`, entry.data ?? "");
    }
  } else {
    // Structured JSON in production — works with Cloudflare log tail + any log aggregator
    console.log(JSON.stringify(entry));
  }
}

// ─── Route logger ─────────────────────────────────────────────────────────────

export class RouteLogger {
  constructor(private readonly ctx: LogContext) {}

  /** General information — use for successful operations you want to trace. */
  info(message: string, data?: Record<string, unknown>): void {
    emit({
      level: "info",
      timestamp: new Date().toISOString(),
      route: this.ctx.route,
      userId: this.ctx.userId,
      orgId: this.ctx.orgId,
      role: this.ctx.role,
      message,
      data: data ? redact(data) : undefined,
    });
  }

  /** Something unexpected but non-fatal — worth investigating. */
  warn(message: string, data?: Record<string, unknown>): void {
    emit({
      level: "warn",
      timestamp: new Date().toISOString(),
      route: this.ctx.route,
      userId: this.ctx.userId,
      orgId: this.ctx.orgId,
      role: this.ctx.role,
      message,
      data: data ? redact(data) : undefined,
    });
  }

  /**
   * An error that caused a 500 response.
   * Always pass the caught error object as the second argument.
   *
   * @param message  Short description of what failed, e.g. "DB insert failed"
   * @param error    The caught error (from catch block)
   * @param data     Optional extra context, e.g. { patientId: "abc123" }
   */
  error(message: string, error: unknown, data?: Record<string, unknown>): void {
    const err = error instanceof Error ? error : new Error(String(error));
    emit({
      level: "error",
      timestamp: new Date().toISOString(),
      route: this.ctx.route,
      userId: this.ctx.userId,
      orgId: this.ctx.orgId,
      role: this.ctx.role,
      message,
      error: {
        name: err.name,
        message: err.message,
        // Only include stack trace in development — stacks can leak internal paths
        stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
      },
      data: data ? redact(data) : undefined,
    });
  }

  /**
   * Security-relevant events — auth failures, permission denials, suspicious input.
   * These are always logged regardless of log level settings.
   */
  security(message: string, data?: Record<string, unknown>): void {
    emit({
      level: "security",
      timestamp: new Date().toISOString(),
      route: this.ctx.route,
      userId: this.ctx.userId,
      orgId: this.ctx.orgId,
      role: this.ctx.role,
      message,
      data: data ? redact(data) : undefined,
    });
  }

  /** Debug-level — only useful during development. */
  debug(message: string, data?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === "production") return;
    emit({
      level: "debug",
      timestamp: new Date().toISOString(),
      route: this.ctx.route,
      userId: this.ctx.userId,
      orgId: this.ctx.orgId,
      role: this.ctx.role,
      message,
      data: data ? redact(data) : undefined,
    });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

type SessionLike = { userId?: string; orgId?: string; role?: string } | null | undefined;

/**
 * Create a logger scoped to a specific route.
 * Call this once at the top of each API route handler.
 *
 * @param route    e.g. "POST /api/patients" or "GET /api/visits/[id]"
 * @param session  The session object from getSession() — adds userId/orgId/role to every log
 *
 * @example
 *   const log = logger.forRoute("PATCH /api/patients/[id]", session);
 *   log.error("DB update failed", err, { patientId: id });
 */
export const logger = {
  forRoute(route: string, session?: SessionLike): RouteLogger {
    return new RouteLogger({
      route,
      userId: session?.userId,
      orgId: session?.orgId,
      role: session?.role,
    });
  },
};
