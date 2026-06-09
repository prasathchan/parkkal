import { eq, and } from "drizzle-orm";
import { orgRoles, organizationMembers } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";

/** POST /api/org/roles/[roleId]/migrate — move all members to another role, then delete (ADMIN only) */
export const POST = withRoute<{ roleId: string }>(
  { route: "POST /api/org/roles/[roleId]/migrate", rateLimit: RATE_LIMITS.ADMIN, adminOnly: true },
  async (req, { session, db, log }, { roleId }) => {
    const { targetRoleId } = await req.json() as { targetRoleId: string };
    if (!targetRoleId) return apiError("targetRoleId is required", 400);
    if (targetRoleId === roleId) return apiError("Source and target roles must be different", 400);

    const [sourceRole] = await db.select().from(orgRoles).where(and(eq(orgRoles.id, roleId), eq(orgRoles.organizationId, session.orgId)));
    if (!sourceRole) return apiError("Source role not found", 404);
    if (sourceRole.isSystem) return apiError("System roles cannot be deleted", 403);

    const [targetRole] = await db.select().from(orgRoles).where(and(eq(orgRoles.id, targetRoleId), eq(orgRoles.organizationId, session.orgId)));
    if (!targetRole) return apiError("Target role not found", 404);

    const result = await db.update(organizationMembers).set({ orgRoleId: targetRoleId })
      .where(and(eq(organizationMembers.orgRoleId, roleId), eq(organizationMembers.organizationId, session.orgId)));

    await db.delete(orgRoles).where(eq(orgRoles.id, roleId));

    const migratedCount = (result as { rowsAffected?: number }).rowsAffected ?? 0;
    log.info("Role migrated and deleted", { sourceRoleId: roleId, targetRoleId, migratedCount });
    return apiOk({ success: true, migratedCount });
  }
);
