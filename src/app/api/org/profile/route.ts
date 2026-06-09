import { eq, and } from "drizzle-orm";
import { organizations, organizationMembers, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  logoUrl: z.string().url().optional().or(z.literal("")).nullable(),
  themeConfig: z.union([z.string(), z.record(z.unknown())]).optional(),
});

/** GET /api/org/profile — fetch the current org's settings */
export const GET = withRoute(
  { route: "GET /api/org/profile", rateLimit: RATE_LIMITS.READ },
  async (_req, { session, db }) => {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, session.orgId));
    if (!org) return apiError("Organization not found", 404);
    return apiOk({ organization: org });
  }
);

/** PATCH /api/org/profile — update org settings (ADMIN only) */
export const PATCH = withRoute(
  { route: "PATCH /api/org/profile", rateLimit: RATE_LIMITS.ADMIN, adminOnly: true },
  async (req, { session, db, log }) => {
    const parsed = updateOrgSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Invalid input", 400);

    const { name, address, phone, email, logoUrl, themeConfig } = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email || null;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl || null;
    if (themeConfig !== undefined) updates.themeConfig = typeof themeConfig === "string" ? themeConfig : JSON.stringify(themeConfig);

    await db.update(organizations).set(updates).where(eq(organizations.id, session.orgId));

    // Keep the org admin's phone in sync when the org phone changes
    if (phone !== undefined && phone !== null) {
      const [adminMember] = await db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.role, "ADMIN")))
        .limit(1);
      if (adminMember) {
        await db.update(users).set({ phone, updatedAt: Date.now() }).where(eq(users.id, adminMember.userId));
      }
    }

    writeAuditLog({ organizationId: session.orgId, actorId: session.userId, actorRole: session.role, action: "ORG_PROFILE_UPDATED", targetType: "organization", targetId: session.orgId });
    log.info("Org profile updated");
    return apiOk({ success: true });
  }
);
