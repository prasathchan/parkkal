import { eq, and } from "drizzle-orm";
import { organizationMembers } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const patchSchema = z.object({
  role: z.enum(["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "ATTENDANT", "HELPER"]).optional(),
  salaryType: z.enum(["FIXED", "PER_APPOINTMENT"]).optional(),
  salaryAmount: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  isDoctor: z.boolean().optional(),
  orgRoleId: z.string().optional().nullable(),
});

/** PATCH /api/org/members/[userId] — update role, salary, active status (ADMIN only) */
export const PATCH = withRoute<{ userId: string }>(
  { route: "PATCH /api/org/members/[userId]", rateLimit: RATE_LIMITS.ADMIN, adminOnly: true },
  async (req, { session, db, log }, { userId }) => {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Invalid input", 400);

    const [membership] = await db.select({ id: organizationMembers.id }).from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId)));
    if (!membership) return apiError("Member not found", 404);

    const data = parsed.data;
    const updates: Record<string, unknown> = {};
    if (data.role !== undefined) updates.role = data.role;
    if (data.salaryType !== undefined) updates.salaryType = data.salaryType;
    if (data.salaryAmount !== undefined) updates.salaryAmount = data.salaryAmount;
    if (data.isActive !== undefined) updates.isActive = data.isActive ? 1 : 0;
    if (data.isDoctor !== undefined) updates.isDoctor = data.isDoctor ? 1 : 0;
    if (data.orgRoleId !== undefined) updates.orgRoleId = data.orgRoleId;

    await db.update(organizationMembers).set(updates)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId)));

    const action = data.isActive === false ? "MEMBER_DEACTIVATED" : data.orgRoleId ? "MEMBER_ROLE_CHANGED" : "MEMBER_UPDATED";
    writeAuditLog({ organizationId: session.orgId, actorId: session.userId, actorRole: session.role, action, targetType: "member", targetId: userId, metadata: { updatedFields: Object.keys(updates) } });
    log.info("Member updated", { targetUserId: userId, updates: Object.keys(updates) });
    return apiOk({ success: true });
  }
);

/** DELETE /api/org/members/[userId] — remove a member from the org (ADMIN only) */
export const DELETE = withRoute<{ userId: string }>(
  { route: "DELETE /api/org/members/[userId]", rateLimit: RATE_LIMITS.DESTRUCTIVE, adminOnly: true },
  async (_req, { session, db, log }, { userId }) => {
    if (userId === session.userId) return apiError("You cannot remove yourself from the organization", 400);

    const [membership] = await db.select({ id: organizationMembers.id }).from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId)));
    if (!membership) return apiError("Member not found", 404);

    await db.delete(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId)));

    writeAuditLog({ organizationId: session.orgId, actorId: session.userId, actorRole: session.role, action: "MEMBER_DELETED", targetType: "member", targetId: userId });
    log.info("Member removed from org", { targetUserId: userId });
    return apiOk({ success: true });
  }
);
