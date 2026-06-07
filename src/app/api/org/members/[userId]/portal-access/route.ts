import { NextRequest, NextResponse } from "next/server";
import { eq, and, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizationMembers, users, organizations, verificationTokens } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { sendStaffInviteEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const ADMIN_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

const patchSchema = z.object({
  grant: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`admin:${session.userId}`, ADMIN_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const log = logger.forRoute("PATCH /api/org/members/[userId]/portal-access", session);
  if (session.role !== "ADMIN") {
    log.security("Permission denied: only ADMIN can toggle portal access", { role: session.role });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  try {
    const body = await request.json();
    const { grant } = patchSchema.parse(body);

    const db = getDb();
    const now = Date.now();

    // Find the membership
    const [membership] = await db
      .select({
        id: organizationMembers.id,
        role: organizationMembers.role,
        portalAccess: organizationMembers.portalAccess,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, session.orgId),
          eq(organizationMembers.userId, userId)
        )
      );

    if (!membership) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (membership.role !== "HELPER") {
      return NextResponse.json(
        { error: "Portal access toggle only applies to HELPER role members" },
        { status: 400 }
      );
    }

    if (grant) {
      // Grant portal access
      await db
        .update(organizationMembers)
        .set({ portalAccess: 1 })
        .where(eq(organizationMembers.id, membership.id));

      // Send a STAFF_INVITE token so the HELPER can set their password and log in
      const [user] = await db
        .select({ email: users.email, name: users.name, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, userId));

      if (user && !user.isActive) {
        const appBaseUrl =
          process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

        const tokenCode = crypto.randomUUID();
        const tokenId = `vt_${Array.from(
          crypto.getRandomValues(new Uint8Array(12)),
          (b: number) => b.toString(16).padStart(2, "0")
        ).join("")}`;

        await db.insert(verificationTokens).values({
          id: tokenId,
          userId,
          type: "STAFF_INVITE",
          code: tokenCode,
          expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days
          used: 0,
          createdAt: now,
        });

        const [org] = await db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, session.orgId));

        const activationUrl = `${appBaseUrl}/activate?token=${tokenCode}`;

        try {
          await sendStaffInviteEmail(
            user.email,
            user.name,
            org?.name ?? "your clinic",
            activationUrl
          );
        } catch (emailErr) {
          log.warn("Failed to send portal access invite email", { userId, error: String(emailErr) });
          // Don't fail — the membership update is already committed.
        }
      }
    } else {
      // Revoke portal access
      await db
        .update(organizationMembers)
        .set({ portalAccess: 0, isActive: 0 })
        .where(eq(organizationMembers.id, membership.id));

      // Deactivate user account only if they have no other active memberships with portal access
      const [otherActiveMembership] = await db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.isActive, 1),
            eq(organizationMembers.portalAccess, 1),
            ne(organizationMembers.organizationId, session.orgId)
          )
        );

      if (!otherActiveMembership) {
        await db
          .update(users)
          .set({ isActive: 0 })
          .where(eq(users.id, userId));
      }
    }

    writeAuditLog({ organizationId: session.orgId, actorId: session.userId, actorRole: session.role, action: "MEMBER_PORTAL_ACCESS_CHANGED", targetType: "member", targetId: userId, metadata: { grant } });
    log.info("Portal access updated", { targetUserId: userId, grant });
    return NextResponse.json({ success: true, portalAccess: grant ? 1 : 0 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    log.error("Failed to update portal access", error, { targetUserId: userId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
