/**
 * GET /api/calendar/outlook/callback
 * Handles the Microsoft OAuth redirect. Stores encrypted tokens.
 */
import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { calendarIntegrations } from "@/db/schema";
import { getDb } from "@/lib/db";
import { encryptField } from "@/lib/encryption";
import { exchangeOutlookCode, generateId } from "@/lib/calendar-sync";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return Response.redirect(new URL("/dashboard/settings/calendar?error=outlook_denied", req.url));
  }

  const session = await getSession(req);
  if (!session) {
    return Response.redirect(new URL("/dashboard/settings/calendar?error=outlook_denied", req.url));
  }

  try {
    const db = getDb();

    const { userId, orgId, nonce } = JSON.parse(Buffer.from(state, "base64url").toString()) as { userId: string; orgId: string; nonce?: string };
    const storedNonce = req.cookies.get("cal_oauth_nonce")?.value;
    if (!nonce || !storedNonce || storedNonce !== nonce || session.userId !== userId || session.orgId !== orgId) {
      return Response.redirect(new URL("/dashboard/settings/calendar?error=outlook_denied", req.url));
    }

    const tokens = await exchangeOutlookCode(code);

    const [encAccess, encRefresh] = await Promise.all([
      encryptField(tokens.accessToken),
      encryptField(tokens.refreshToken),
    ]);
    if (!encAccess || !encRefresh) throw new Error("Token encryption failed");

    const [existing] = await db
      .select({ id: calendarIntegrations.id })
      .from(calendarIntegrations)
      .where(and(eq(calendarIntegrations.userId, userId), eq(calendarIntegrations.provider, "OUTLOOK")));

    const now = Date.now();
    if (existing) {
      await db
        .update(calendarIntegrations)
        .set({ accessToken: encAccess, refreshToken: encRefresh, expiresAt: tokens.expiresAt, isActive: 1, updatedAt: now })
        .where(eq(calendarIntegrations.id, existing.id));
    } else {
      await db.insert(calendarIntegrations).values({
        id: generateId(), organizationId: orgId, userId, provider: "OUTLOOK",
        accessToken: encAccess, refreshToken: encRefresh,
        expiresAt: tokens.expiresAt, eventIdMap: "{}", isActive: 1, createdAt: now, updatedAt: now,
      });
    }

    return Response.redirect(new URL("/dashboard/settings/calendar?connected=outlook", req.url));
  } catch (err) {
    console.error("[CALENDAR] Outlook callback error:", err);
    return Response.redirect(new URL("/dashboard/settings/calendar?error=outlook_failed", req.url));
  }
}
