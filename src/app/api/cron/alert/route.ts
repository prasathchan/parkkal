/**
 * GET /api/cron/alert
 *
 * Runs every 15 minutes. Queries app_logs for error/security events in the
 * last 15 minutes. If the count exceeds ALERT_THRESHOLD, sends a single email
 * alert via Resend so on-call is notified without needing a separate monitoring
 * service.
 *
 * Deduplication: stores the last alerted window in a D1 row so back-to-back
 * alert ticks don't send duplicate emails — only the first tick of each spike fires.
 *
 * Auth: verifyCronAuth (x-cloudflare-cron header OR Bearer CRON_SECRET).
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import env from "@/lib/env";

const WINDOW_MS       = 15 * 60 * 1000;   // 15-min look-back (matches cron cadence)
const ALERT_THRESHOLD = 10;                // errors per window before alerting
const COOLDOWN_MS     = 30 * 60 * 1000;   // skip alert if one fired in last 30 min

interface CloudflareEnv {
  DB: D1Database;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  let db: D1Database | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext() as { env?: CloudflareEnv };
    db = ctx?.env?.DB;
  } catch {
    return NextResponse.json({ skipped: true, reason: "no cloudflare context" });
  }

  if (!db) {
    return NextResponse.json({ skipped: true, reason: "no DB binding" });
  }

  const now   = Date.now();
  const since = now - WINDOW_MS;

  // Count errors and security events in the window
  const countRow = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM app_logs WHERE level IN ('error','security') AND created_at >= ?"
    )
    .bind(since)
    .first<{ n: number }>();
  const errorCount = countRow?.n ?? 0;

  if (errorCount < ALERT_THRESHOLD) {
    return NextResponse.json({ checked: true, errorCount, alerted: false });
  }

  // Check cooldown: was an alert already sent in the last 30 min?
  const cooldownSince = now - COOLDOWN_MS;
  const cooldownRow = await db
    .prepare(
      "SELECT created_at FROM app_logs WHERE level = 'info' AND route = 'cron/alert' AND created_at >= ? LIMIT 1"
    )
    .bind(cooldownSince)
    .first<{ created_at: number }>();

  if (cooldownRow) {
    return NextResponse.json({ checked: true, errorCount, alerted: false, coolingDown: true });
  }

  // Send the alert email
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[ALERT] RESEND_API_KEY not set — cannot send error-spike alert");
    return NextResponse.json({ checked: true, errorCount, alerted: false, reason: "no api key" });
  }

  const alertEmail = env.ALERT_RECIPIENT_EMAIL;
  if (!alertEmail) {
    console.warn("[ALERT] ALERT_EMAIL not set — cannot send error-spike alert");
    return NextResponse.json({ checked: true, errorCount, alerted: false, reason: "no recipient" });
  }

  const windowStart = new Date(since).toISOString().replace("T", " ").slice(0, 19);
  const windowEnd   = new Date(now).toISOString().replace("T", " ").slice(0, 19);

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="color:#dc2626">⚠️ Parkkal Error Rate Alert</h2>
      <p>
        <strong>${errorCount}</strong> error/security events were logged in the last 15 minutes
        (threshold: ${ALERT_THRESHOLD}).
      </p>
      <table style="border-collapse:collapse;font-size:14px;color:#374151">
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Window</td>
            <td>${windowStart} → ${windowEnd} UTC</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Count</td>
            <td>${errorCount} errors/security events</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600">Threshold</td>
            <td>${ALERT_THRESHOLD}</td></tr>
      </table>
      <p style="margin-top:16px">
        <a href="https://parkkal-dental.chandran-aathi.workers.dev/dashboard/settings"
           style="color:#2563eb">View admin app logs →</a>
      </p>
      <p style="font-size:12px;color:#9ca3af;margin-top:24px">
        Alert fired by /api/cron/alert · ${new Date(now).toISOString()}
      </p>
    </div>
  `;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Parkkal Alerts <noreply@parkkal.com>",
      to: [alertEmail],
      subject: `⚠️ Parkkal alert: ${errorCount} errors in 15 min`,
      html,
    }),
  });

  // Record that we sent an alert (used by cooldown check — reuses app_logs table)
  await db
    .prepare(
      "INSERT INTO app_logs (id, level, route, message, created_at) VALUES (?, 'info', 'cron/alert', ?, ?)"
    )
    .bind(`alert-${now}`, `Alert sent: ${errorCount} errors in 15 min`, now)
    .run()
    .catch(() => {});

  const sent = resendRes.ok;
  if (!sent) {
    console.error("[ALERT] Resend returned", resendRes.status);
  }

  return NextResponse.json({ checked: true, errorCount, alerted: sent, emailStatus: resendRes.status });
}
