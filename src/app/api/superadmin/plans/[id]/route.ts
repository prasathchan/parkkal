import { eq } from "drizzle-orm";
import { z } from "zod";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { subscriptionPlans } from "@/db/schema";
import { isSuperAdmin } from "@/lib/superadmin";
import { requireSuperadminToken, logSuperadminAction } from "@/lib/superadmin-auth";

const updateSchema = z.object({
  name:         z.string().min(1).max(60).optional(),
  description:  z.string().max(200).optional(),
  priceMonthly: z.number().min(0).optional(),
  maxDoctors:   z.number().int().positive().nullable().optional(),
  maxStaff:     z.number().int().positive().nullable().optional(),
  features:     z.array(z.string()).optional(),
  isActive:     z.boolean().optional(),
  sortOrder:    z.number().int().optional(),
});

export const PUT = withRoute<{ id: string }>(
  { route: "PUT /api/superadmin/plans/[id]", rateLimit: RATE_LIMITS.WRITE, skipSubscriptionCheck: true },
  async (req, { session, db, log }, { id }) => {
    if (!await isSuperAdmin(db, session.userId)) return apiError("Forbidden", 403);
    if (!await requireSuperadminToken(req, session.userId)) {
      log.security("Superadmin route accessed without valid superadmin session token", {});
      return apiError("Superadmin session token required. Call POST /api/superadmin/auth first.", 401);
    }
    const body = updateSchema.parse(await req.json());
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (body.name         !== undefined) updates.name         = body.name;
    if (body.description  !== undefined) updates.description  = body.description;
    if (body.priceMonthly !== undefined) updates.priceMonthly = body.priceMonthly;
    if (body.maxDoctors   !== undefined) updates.maxDoctors   = body.maxDoctors;
    if (body.maxStaff     !== undefined) updates.maxStaff     = body.maxStaff;
    if (body.features     !== undefined) updates.features     = JSON.stringify(body.features);
    if (body.isActive     !== undefined) updates.isActive     = body.isActive ? 1 : 0;
    if (body.sortOrder    !== undefined) updates.sortOrder    = body.sortOrder;
    await db.update(subscriptionPlans).set(updates).where(eq(subscriptionPlans.id, id));
    await logSuperadminAction(session.userId, "UPDATE_PLAN", { planId: id, updatedFields: Object.keys(updates) });
    return apiOk({ updated: true });
  }
);
