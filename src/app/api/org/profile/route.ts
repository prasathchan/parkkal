import { eq, and } from "drizzle-orm";
import { organizations, organizationMembers, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { createOrgToken } from "@/lib/auth";
import { z } from "zod";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  tagline: z.string().max(100).optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  logoUrl: z.string().url().optional().or(z.literal("")).nullable(),
  themeConfig: z.union([z.string(), z.record(z.unknown())]).optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional().nullable().or(z.literal("")),
  gstRegistered: z.boolean().optional(),
  gstStateCode: z.string().max(2).optional().nullable(),
  cgstRate: z.number().min(0).max(14).optional(),
  sgstRate: z.number().min(0).max(14).optional(),
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

    const { name, tagline, address, phone, email, logoUrl, themeConfig, gstin, gstRegistered, gstStateCode, cgstRate, sgstRate } = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (name !== undefined) updates.name = name;
    if (tagline !== undefined) updates.tagline = tagline || null;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email || null;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl || null;
    if (themeConfig !== undefined) updates.themeConfig = typeof themeConfig === "string" ? themeConfig : JSON.stringify(themeConfig);
    if (gstin !== undefined) updates.gstin = gstin || null;
    if (gstRegistered !== undefined) updates.gstRegistered = gstRegistered ? 1 : 0;
    if (gstStateCode !== undefined) updates.gstStateCode = gstStateCode || null;
    if (cgstRate !== undefined) updates.cgstRate = cgstRate;
    if (sgstRate !== undefined) updates.sgstRate = sgstRate;

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

    const res = apiOk({ success: true });

    // Re-issue session cookie so the sidebar reflects the new org name immediately
    if (name !== undefined) {
      const newToken = await createOrgToken({
        userId: session.userId,
        email: session.email,
        name: session.name,
        orgId: session.orgId,
        orgName: name,
        orgSlug: session.orgSlug,
        role: session.role,
        orgRoleId: session.orgRoleId ?? null,
        permissions: session.permissions,
      });
      res.cookies.set("pkd_org_session", newToken, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 });
    }

    return res;
  }
);
