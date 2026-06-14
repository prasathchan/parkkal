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
  // Generate a random nonce bound to this initiation; verified in the callback to prevent CSRF.
  const nonce = crypto.randomUUID();
  const state = Buffer.from(JSON.stringify({ userId: session.userId, orgId: session.orgId, nonce })).toString("base64url");
  const res = NextResponse.redirect(getGoogleAuthUrl(state));
  res.cookies.set("cal_oauth_nonce", nonce, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 300, path: "/api/calendar",
  });
  return res;
}
