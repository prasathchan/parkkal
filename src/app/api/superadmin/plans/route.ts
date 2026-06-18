import { z } from "zod";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { subscriptionPlans } from "@/db/schema";
import { isSuperAdmin } from "@/lib/superadmin";
import { requireSuperadminToken, logSuperadminAction } from "@/lib/superadmin-auth";

const planSchema = z.object({
  name:         z.string().min(1).max(60),
  slug:         z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
  description:  z.string().max(200).optional(),
  priceMonthly: z.number().min(0),
  maxDoctors:   z.number().int().positive().nullable(),
  maxStaff:     z.number().int().positive().nullable(),
  features:     z.array(z.string()),
  isActive:     z.boolean().optional().default(true),
  sortOrder:    z.number().int().optional().default(0),
});

export const GET = withRoute(
  { route: "GET /api/superadmin/plans", rateLimit: RATE_LIMITS.READ, skipSubscriptionCheck: true },
  async (req, { session, db, log }) => {
    if (!await isSuperAdmin(db, session.userId)) return apiError("Forbidden", 403);
    if (!await requireSuperadminToken(req, session.userId)) {
      log.security("Superadmin route accessed without valid superadmin session token", {});
      return apiError("Superadmin session token required. Call POST /api/superadmin/auth first.", 401);
    }
    await logSuperadminAction(session.userId, "LIST_PLANS");
    const plans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
    return apiOk({ plans });
  }
);

export const POST = withRoute(
  { route: "POST /api/superadmin/plans", rateLimit: RATE_LIMITS.WRITE, skipSubscriptionCheck: true },
  async (req, { session, db, log }) => {
    if (!await isSuperAdmin(db, session.userId)) return apiError("Forbidden", 403);
    if (!await requireSuperadminToken(req, session.userId)) {
      log.security("Superadmin route accessed without valid superadmin session token", {});
      return apiError("Superadmin session token required. Call POST /api/superadmin/auth first.", 401);
    }
    const body = planSchema.parse(await req.json());
    const now  = Date.now();
    const id   = `plan_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    await db.insert(subscriptionPlans).values({
      id, ...body,
      features:  JSON.stringify(body.features),
      isActive:  body.isActive ? 1 : 0,
      createdAt: now, updatedAt: now,
    });
    await logSuperadminAction(session.userId, "CREATE_PLAN", { planId: id, slug: body.slug });
    return apiOk({ id }, 201);
  }
);
