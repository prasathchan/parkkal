/**
 * GET /api/calendar/google
 * Initiates the Google Calendar OAuth flow.
 * The user must already be authenticated (cookie session checked below).
 */
import env from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/calendar-sync";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!env.GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: "Google Calendar integration is not configured on this server" }, { status: 503 });
  }
  const state = Buffer.from(JSON.stringify({ userId: session.userId, orgId: session.orgId })).toString("base64url");
  return NextResponse.redirect(getGoogleAuthUrl(state));
}
