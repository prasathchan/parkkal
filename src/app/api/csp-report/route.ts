import { NextResponse } from "next/server";
import { writeAppLog } from "@/lib/app-logger";

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
  try {
    const body = await req.json() as Record<string, unknown>;
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
