import { eq, and } from "drizzle-orm";
import { orgRoles, organizationMembers, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

/** GET /api/org/roles/[roleId] — fetch role details + assigned members */
export const GET = withRoute<{ roleId: string }>(
  { route: "GET /api/org/roles/[roleId]", rateLimit: RATE_LIMITS.READ },
  async (_req, { session, db }, { roleId }) => {
    const [role] = await db.select().from(orgRoles)
      .where(and(eq(orgRoles.id, roleId), eq(orgRoles.organizationId, session.orgId)));
    if (!role) return apiError("Role not found", 404);

    const members = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(organizationMembers)
      .leftJoin(users, eq(organizationMembers.userId, users.id))
      .where(and(eq(organizationMembers.orgRoleId, roleId), eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.isActive, 1)));

    return apiOk({ role: { ...role, permissions: JSON.parse(role.permissions || "[]") }, members });
  }
);

/** PATCH /api/org/roles/[roleId] — update role name, color, permissions (ADMIN only) */
export const PATCH = withRoute<{ roleId: string }>(
  { route: "PATCH /api/org/roles/[roleId]", rateLimit: RATE_LIMITS.ADMIN, adminOnly: true },
  async (req, { session, db, log }, { roleId }) => {
    const [role] = await db.select().from(orgRoles)
      .where(and(eq(orgRoles.id, roleId), eq(orgRoles.organizationId, session.orgId)));
    if (!role) return apiError("Role not found", 404);

    const { name, description, color, permissions } = await req.json() as { name?: string; description?: string; color?: string; permissions?: string[] };

    const membersWithRole = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(organizationMembers)
      .leftJoin(users, eq(organizationMembers.userId, users.id))
      .where(and(eq(organizationMembers.orgRoleId, roleId), eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.isActive, 1)));

    const updates: Partial<typeof role> = { updatedAt: Date.now() };
    if (name !== undefined) { updates.name = name.trim(); if (!role.isSystem) updates.slug = nameToSlug(name.trim()); }
    if (description !== undefined) updates.description = description || null;
    if (color !== undefined) updates.color = color;
    if (permissions !== undefined) updates.permissions = JSON.stringify(permissions);

    await db.update(orgRoles).set(updates).where(eq(orgRoles.id, roleId));
    writeAuditLog({ organizationId: session.orgId, actorId: session.userId, actorRole: session.role, action: "ROLE_UPDATED", targetType: "role", targetId: roleId });
    log.info("Role updated", { roleId, affectedUsers: membersWithRole.length });
    return apiOk({ role: { ...role, ...updates, permissions: permissions ?? JSON.parse(role.permissions || "[]") }, affectedUsers: membersWithRole.length });
  }
);

/** DELETE /api/org/roles/[roleId] — delete a custom role (ADMIN only, no active members) */
export const DELETE = withRoute<{ roleId: string }>(
  { route: "DELETE /api/org/roles/[roleId]", rateLimit: RATE_LIMITS.DESTRUCTIVE, adminOnly: true },
  async (_req, { session, db, log }, { roleId }) => {
    const [role] = await db.select().from(orgRoles)
      .where(and(eq(orgRoles.id, roleId), eq(orgRoles.organizationId, session.orgId)));
    if (!role) return apiError("Role not found", 404);
    if (role.isSystem) return apiError("System roles cannot be deleted", 403);

    const membersWithRole = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(organizationMembers)
      .leftJoin(users, eq(organizationMembers.userId, users.id))
      .where(and(eq(organizationMembers.orgRoleId, roleId), eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.isActive, 1)));

    if (membersWithRole.length > 0) {
      return apiError("ROLE_HAS_USERS", 409);
    }

    await db.delete(orgRoles).where(eq(orgRoles.id, roleId));
    writeAuditLog({ organizationId: session.orgId, actorId: session.userId, actorRole: session.role, action: "ROLE_DELETED", targetType: "role", targetId: roleId });
    log.info("Role deleted", { roleId });
    return apiOk({ success: true });
  }
);
