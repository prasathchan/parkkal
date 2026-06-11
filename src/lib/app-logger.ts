/**
 * lib/app-logger.ts
 *
 * Self-hosted error & security event capture for the admin log viewer.
 *
 * WHY:
 *   console.error() in Cloudflare Workers goes to `wrangler tail` but is
 *   invisible to clinic staff who need to investigate "why did that fail?".
 *   This writes structured error records to D1 so ADMIN users can browse
 *   them in the app without needing Cloudflare access.
 *
 * WHAT GETS CAPTURED:
 *   - 'error'    — unhandled exceptions in withRoute() (HTTP 500s)
 *   - 'security' — auth failures, permission denials, revoked token use
 *   - 'warn'     — degraded-mode conditions worth watching
 *
 * WHAT IS INTENTIONALLY EXCLUDED:
 *   - 'info' / 'debug' — too high-volume; use wrangler tail for those.
 *   - PHI (patient names, phone numbers, PAN/Aadhaar) — never stored.
 *     Error data only carries IDs and structural context (route, status, etc.)
 *
 * USAGE (called internally by withRoute):
 *   writeAppLog({
 *     level: "error",
 *     route: "POST /api/patients",
 *     message: "Unhandled route error",
 *     error: someError,
 *     organizationId: session?.orgId,
 *     userId: session?.userId,
 *     userRole: session?.role,
 *     data: { patientId: "p1" },
 *   });
 */

import { getDb } from "@/lib/db";
import { appLogs } from "@/db/schema";
import env from "@/lib/env";

// Dedup window — suppress duplicate alerts for the same route within 5 minutes.
// Workers instances are short-lived so this is per-request, but it prevents
// thundering-herd email spam during a bad deploy.
const _recentAlerts = new Map<string, number>();
const ALERT_DEDUP_MS = 5 * 60 * 1_000;

async function sendErrorAlert(params: AppLogParams): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  const fromEmail = env.RESEND_FROM_EMAIL ?? "alerts@parkkal.com";
  // Only alert for 'error' level, and only when Resend is configured.
  if (!apiKey || params.level !== "error") return;

  const dedupKey = `${params.route}:${params.message.slice(0, 80)}`;
  const lastSent = _recentAlerts.get(dedupKey) ?? 0;
  if (Date.now() - lastSent < ALERT_DEDUP_MS) return;
  _recentAlerts.set(dedupKey, Date.now());

  const err = params.error instanceof Error ? params.error : null;
  const body = [
    `<b>Route:</b> ${params.route}`,
    `<b>Message:</b> ${params.message}`,
    params.organizationId ? `<b>Org:</b> ${params.organizationId}` : null,
    params.userId        ? `<b>User:</b> ${params.userId}` : null,
    err?.stack ? `<pre style="font-size:12px">${err.stack.slice(0, 1_500)}</pre>` : null,
  ].filter(Boolean).join("<br>");

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Parkkal Alerts <${fromEmail}>`,
        to: [fromEmail],
        subject: `[Parkkal ERROR] ${params.route}`,
        html: body,
      }),
    });
  } catch {
    // Alert sending must never throw — swallow silently.
  }
}

export type AppLogLevel = "error" | "security" | "warn";

/**
 * trackError — convenience wrapper for catch blocks.
 * Logs an error event without requiring a full route/userId context.
 */
export function trackError(context: string, error: unknown, meta?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  writeAppLog({ level: "error", route: context, message: `[${context}] ${message}`, error, data: meta });
}

export interface AppLogParams {
  level:           AppLogLevel;
  route:           string;
  message:         string;
  error?:          unknown;
  organizationId?: string | null;
  userId?:         string | null;
  userRole?:       string | null;
  /** Arbitrary structured context — must NOT contain PHI */
  data?:           Record<string, unknown>;
}

const STACK_MAX = 2_000; // characters — keeps D1 rows small

export function writeAppLog(params: AppLogParams): void {
  const writePromise = (async () => {
    try {
      const err = params.error instanceof Error ? params.error : null;

      // Fire alert email for errors (non-blocking, best-effort).
      void sendErrorAlert(params);

      const db = getDb();
      await db.insert(appLogs).values({
        id:             crypto.randomUUID(),
        level:          params.level,
        route:          params.route,
        message:        params.message,
        organizationId: params.organizationId ?? null,
        userId:         params.userId ?? null,
        userRole:       params.userRole ?? null,
        errorName:      err?.name ?? null,
        errorStack:     err?.stack?.slice(0, STACK_MAX) ?? null,
        data:           params.data ? JSON.stringify(params.data) : null,
        createdAt:      Date.now(),
      });
    } catch {
      // Swallow — a logging failure must never surface to the API caller
      console.error("[app-logger] failed to write log entry", params.level, params.route);
    }
  })();

  // In Cloudflare Workers the runtime kills unawaited promises once a Response is
  // returned.  waitUntil() keeps the log write alive past the response boundary so
  // app_logs entries are reliably persisted in production.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    if (ctx?.ctx?.waitUntil) {
      ctx.ctx.waitUntil(writePromise);
    }
  } catch {
    // Not in a Workers context (local dev, test env) — the promise runs normally.
  }
}
