import { eq, and, sql, isNull } from "drizzle-orm";
import { orgRoles, organizationMembers } from "@/db/schema";
import { DEFAULT_ROLES } from "@/lib/default-roles";
import { writeAuditLog } from "@/lib/audit";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";

// Maps system role enum → default role slug for auto-backfill
const SYSTEM_ROLE_TO_SLUG: Record<string, string> = {
  ADMIN: "administrator", DOCTOR: "doctor", NURSE: "nurse",
  RECEPTIONIST: "receptionist", ATTENDANT: "attendant", HELPER: "attendant",
};

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

async function seedDefaultRoles(db: ReturnType<typeof import("@/lib/db").getDb>, orgId: string) {
  const now = Date.now();
  await db.insert(orgRoles).values(DEFAULT_ROLES.map((r) => ({
    id: `role_${orgId}_${r.slug}_${now}`,
    organizationId: orgId,
    name: r.name, slug: r.slug, description: r.description,
    color: r.color, isSystem: r.isSystem,
    permissions: JSON.stringify(r.permissions),
    createdAt: now, updatedAt: now,
  })));
}

/** GET /api/org/roles — list org role definitions (ADMIN only) */
export const GET = withRoute(
  { route: "GET /api/org/roles", adminOnly: true },
  async (_req, { session, db, log }) => {
    let roles = await db
      .select({ id: orgRoles.id, name: orgRoles.name, slug: orgRoles.slug, description: orgRoles.description, color: orgRoles.color, isSystem: orgRoles.isSystem, permissions: orgRoles.permissions })
      .from(orgRoles)
      .where(eq(orgRoles.organizationId, session.orgId))
      .orderBy(orgRoles.name);

    // Auto-seed defaults for orgs created before the role system
    if (roles.length === 0) {
      try {
        await seedDefaultRoles(db, session.orgId);
        roles = await db
          .select({ id: orgRoles.id, name: orgRoles.name, slug: orgRoles.slug, description: orgRoles.description, color: orgRoles.color, isSystem: orgRoles.isSystem, permissions: orgRoles.permissions })
          .from(orgRoles).where(eq(orgRoles.organizationId, session.orgId)).orderBy(orgRoles.name);
      } catch (e) { log.warn("Role seeding failed", { error: String(e) }); }
    }

    // One-time backfill: assign orgRoleId to members that still have null (self-disabling)
    try {
      const slugToId: Record<string, string> = {};
      for (const r of roles) slugToId[r.slug] = r.id;
      const unassigned = await db.select({ id: organizationMembers.id, role: organizationMembers.role }).from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, session.orgId), isNull(organizationMembers.orgRoleId)));
      for (const m of unassigned) {
        const slug = SYSTEM_ROLE_TO_SLUG[m.role];
        const roleId = slug ? slugToId[slug] : null;
        if (roleId) await db.update(organizationMembers).set({ orgRoleId: roleId }).where(eq(organizationMembers.id, m.id));
      }
    } catch (e) { log.warn("Member role auto-assign failed", { error: String(e) }); }

    // Attach active member counts per role
    const memberCounts = await db
      .select({ orgRoleId: organizationMembers.orgRoleId, count: sql<number>`count(*)` })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.isActive, 1)))
      .groupBy(organizationMembers.orgRoleId);
    const countMap: Record<string, number> = {};
    for (const row of memberCounts) { if (row.orgRoleId) countMap[row.orgRoleId] = Number(row.count); }

    const result = roles.map((r: typeof roles[number]) => ({ ...r, permissions: JSON.parse(r.permissions || "[]") as string[], userCount: countMap[r.id] || 0 }));
    return apiOk({ roles: result });
  }
);

/** POST /api/org/roles — create a custom role (ADMIN only) */
export const POST = withRoute(
  { route: "POST /api/org/roles", rateLimit: RATE_LIMITS.ADMIN, adminOnly: true },
  async (req, { session, db, log }) => {
    const { name, description, color, permissions } = await req.json() as { name?: string; description?: string; color?: string; permissions?: string[] };
    if (!name?.trim()) return apiError("Name is required", 400);

    const slug = nameToSlug(name.trim());
    const [existing] = await db.select({ id: orgRoles.id }).from(orgRoles)
      .where(and(eq(orgRoles.organizationId, session.orgId), eq(orgRoles.slug, slug)));
    if (existing) return apiError("A role with this name already exists", 409);

    const now = Date.now();
    const newRole = {
      id: `role_${session.orgId}_${slug}_${now}`,
      organizationId: session.orgId,
      name: name.trim(), slug, description: description || null,
      color: color || "#3B82F6", isSystem: 0,
      permissions: JSON.stringify(permissions || []),
      createdAt: now, updatedAt: now,
    };

    await db.insert(orgRoles).values(newRole);
    writeAuditLog({ organizationId: session.orgId, actorId: session.userId, actorRole: session.role, action: "ROLE_CREATED", targetType: "role", targetId: newRole.id, metadata: { roleName: newRole.name } });
    log.info("Role created", { roleId: newRole.id, roleName: newRole.name });
    return apiOk({ role: { ...newRole, permissions: permissions || [] } }, 201);
  }
);
