import { NextResponse } from "next/server";
import { writeAppLog } from "@/lib/app-logger";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// CSP reports are attacker-controllable; cap stored size to avoid log flooding.
const MAX_REPORT_BYTES = 4096;

/**
 * POST /api/csp-report
 *
 * Receives Content-Security-Policy violation reports from browsers.
 * The middleware sets report-uri /api/csp-report in the CSP header (production only).
 *
 * Browsers POST a JSON body of the form:
 *   { "csp-report": { "document-uri": "...", "blocked-uri": "...", ... } }
 *
 * We persist it to the app_logs table at "security" level so admins can see it
 * in Settings → App Logs without needing external tooling.
 */
export async function POST(req: Request): Promise<Response> {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`csp-report:${ip}`, { limit: 10, windowMs: 60 * 1000 });
  if (!rl.allowed) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const raw = await req.text();
    if (raw.length > MAX_REPORT_BYTES) {
      return new NextResponse(null, { status: 204 });
    }
    const body = JSON.parse(raw) as Record<string, unknown>;
    const report = (body["csp-report"] as Record<string, unknown>) ?? body;

    writeAppLog({
      level: "security",
      route: "POST /api/csp-report",
      message: `CSP violation: ${report["blocked-uri"] ?? "unknown"} blocked on ${report["document-uri"] ?? "unknown"}`,
      data: report,
    });
  } catch {
    // Malformed report body — ignore silently; CSP reports can be garbled
  }

  // Browsers expect 204 No Content from report endpoints
  return new NextResponse(null, { status: 204 });
}
