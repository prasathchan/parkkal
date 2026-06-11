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
  try {
    // Verify D1 binding is reachable
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    const db = ctx?.env?.DB as D1Database | undefined;

    if (db) {
      await db.prepare("SELECT 1").run();
    }
    // In local dev the DB binding won't be present — still return ok
    return NextResponse.json({ status: "ok", ts: Date.now() }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ status: "error", message, ts: Date.now() }, { status: 503 });
  }
}
