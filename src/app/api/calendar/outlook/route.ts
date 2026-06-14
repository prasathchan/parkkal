/**
 * GET /api/calendar/outlook
 * Initiates the Microsoft Outlook Calendar OAuth flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { getOutlookAuthUrl } from "@/lib/calendar-sync";
import { getSession } from "@/lib/auth";
import env from "@/lib/env";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!env.MICROSOFT_CLIENT_ID) {
    return NextResponse.json({ error: "Outlook Calendar integration is not configured on this server" }, { status: 503 });
  }
  const nonce = crypto.randomUUID();
  const state = Buffer.from(JSON.stringify({ userId: session.userId, orgId: session.orgId, nonce })).toString("base64url");
  const res = NextResponse.redirect(getOutlookAuthUrl(state));
  res.cookies.set("cal_oauth_nonce", nonce, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 300, path: "/api/calendar",
  });
  return res;
}
