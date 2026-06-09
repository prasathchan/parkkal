import { eq, and, ne } from "drizzle-orm";
import { organizationMembers, users, organizations, verificationTokens } from "@/db/schema";
import { sendStaffInviteEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/audit";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const patchSchema = z.object({ grant: z.boolean() });

/** PATCH /api/org/members/[userId]/portal-access — grant or revoke portal login for a HELPER */
export const PATCH = withRoute<{ userId: string }>(
  { route: "PATCH /api/org/members/[userId]/portal-access", rateLimit: RATE_LIMITS.ADMIN, adminOnly: true },
  async (req, { session, db, log }, { userId }) => {
    const { grant } = patchSchema.parse(await req.json());
    const now = Date.now();

    const [membership] = await db
      .select({ id: organizationMembers.id, role: organizationMembers.role, portalAccess: organizationMembers.portalAccess })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId)));

    if (!membership) return apiError("Member not found", 404);
    if (membership.role !== "HELPER") return apiError("Portal access toggle only applies to HELPER role members", 400);

    if (grant) {
      await db.update(organizationMembers).set({ portalAccess: 1 }).where(eq(organizationMembers.id, membership.id));

      // Send activation email if the user account is not yet active
      const [user] = await db
        .select({ email: users.email, name: users.name, isActive: users.isActive })
        .from(users).where(eq(users.id, userId));

      if (user && !user.isActive) {
        const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
        const tokenCode = crypto.randomUUID();
        const tokenId = `vt_${Array.from(crypto.getRandomValues(new Uint8Array(12)), (b: number) => b.toString(16).padStart(2, "0")).join("")}`;

        await db.insert(verificationTokens).values({
          id: tokenId, userId, type: "STAFF_INVITE", code: tokenCode,
          expiresAt: now + 7 * 24 * 60 * 60 * 1000, used: 0, createdAt: now,
        });

        const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, session.orgId));
        try {
          await sendStaffInviteEmail(user.email, user.name, org?.name ?? "your clinic", `${appBaseUrl}/activate?token=${tokenCode}`);
        } catch (emailErr) {
          log.warn("Failed to send portal access invite email", { userId, error: String(emailErr) });
        }
      }
    } else {
      // Revoke portal access and deactivate member
      await db.update(organizationMembers).set({ portalAccess: 0, isActive: 0 }).where(eq(organizationMembers.id, membership.id));

      // Deactivate user account only if they have no other org with active portal access
      const [otherActive] = await db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.isActive, 1),
          eq(organizationMembers.portalAccess, 1),
          ne(organizationMembers.organizationId, session.orgId)
        ));

      if (!otherActive) {
        await db.update(users).set({ isActive: 0 }).where(eq(users.id, userId));
      }
    }

    writeAuditLog({ organizationId: session.orgId, actorId: session.userId, actorRole: session.role, action: "MEMBER_PORTAL_ACCESS_CHANGED", targetType: "member", targetId: userId, metadata: { grant } });
    log.info("Portal access updated", { targetUserId: userId, grant });
    return apiOk({ success: true, portalAccess: grant ? 1 : 0 });
  }
);
