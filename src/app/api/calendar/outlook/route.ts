/**
 * GET /api/calendar/outlook
 * Initiates the Microsoft Outlook Calendar OAuth flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { getOutlookAuthUrl } from "@/lib/calendar-sync";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.MICROSOFT_CLIENT_ID) {
    return NextResponse.json({ error: "Outlook Calendar integration is not configured on this server" }, { status: 503 });
  }
  const state = Buffer.from(JSON.stringify({ userId: session.userId, orgId: session.orgId })).toString("base64url");
  return NextResponse.redirect(getOutlookAuthUrl(state));
}
