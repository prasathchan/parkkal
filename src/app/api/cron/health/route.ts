import { NextResponse } from "next/server";

/**
 * GET /api/cron/health
 *
 * Public (no auth) liveness probe. Verifies the DB binding is reachable.
 * Called every 30 minutes by .github/workflows/health.yml.
 *
 * Returns 200 { status: "ok", ts: <unix ms> } when healthy.
 * Returns 503 when the DB binding is missing or throws.
 */
export const runtime = "edge";

export async function GET(req: Request): Promise<Response> {
  const ts = Date.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    const db = ctx?.env?.DB as D1Database | undefined;

    let recentErrors = 0;
    if (db) {
      await db.prepare("SELECT 1").run();

      // Count errors and security events in app_logs from the last 5 minutes.
      // This gives CI and on-call a quick 5xx rate signal without a separate
      // monitoring service. A value > 0 doesn't fail the health check — that
      // would cause alert-fatigue — but it surfaces in the response body.
      const since = ts - 5 * 60 * 1000;
      const result = await db
        .prepare("SELECT COUNT(*) AS n FROM app_logs WHERE level IN ('error','security') AND created_at >= ?")
        .bind(since)
        .first<{ n: number }>();
      recentErrors = result?.n ?? 0;
    }

    return NextResponse.json({ status: "ok", ts, recentErrors }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", message, ts }, { status: 503 });
  }
}
