import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizationMembers, users, organizations, verificationTokens } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { sendStaffInviteEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const ADMIN_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

const schema = z.object({
  // mode controls which activation flow the link points to
  mode: z.enum(["invite_link", "no_login_verify"]).default("invite_link"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`admin:${session.userId}`, ADMIN_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const { userId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const { mode } = schema.parse(body);

    const db = getDb();

    // Confirm target user exists and belongs to this org
    const [member] = await db
      .select({ userId: organizationMembers.userId, portalAccess: organizationMembers.portalAccess })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId)));

    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name, isActive: users.isActive, isVerified: users.isVerified })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Invalidate previous unused STAFF_INVITE tokens for this user
    await db.delete(verificationTokens)
      .where(and(eq(verificationTokens.userId, userId), eq(verificationTokens.type, "STAFF_INVITE"), eq(verificationTokens.used, 0)));

    const now = Date.now();
    const tokenCode = crypto.randomUUID();
    const tokenId = `vt_${Array.from(crypto.getRandomValues(new Uint8Array(12)), (b: number) => b.toString(16).padStart(2, "0")).join("")}`;

    await db.insert(verificationTokens).values({
      id: tokenId,
      userId,
      type: "STAFF_INVITE",
      code: tokenCode,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      used: 0,
      createdAt: now,
    });

    const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, session.orgId));
    const orgName = org?.name ?? "your clinic";

    const modeParam = mode === "no_login_verify" ? "&mode=verify" : "";
    const activationUrl = `${appBaseUrl}/activate?token=${tokenCode}${modeParam}`;

    try {
      await sendStaffInviteEmail(user.email, user.name, orgName, activationUrl);
    } catch (err) {
      console.error("Failed to send activation email:", err);
      return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ sent: true, email: user.email });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Send activation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
