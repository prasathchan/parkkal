import { eq } from "drizzle-orm";
import { z } from "zod";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { subscriptions, subscriptionPlans } from "@/db/schema";
import { isSuperAdmin } from "@/lib/superadmin";
import { requireSuperadminToken, logSuperadminAction } from "@/lib/superadmin-auth";

const schema = z.object({
  planSlug:     z.string(),
  months:       z.number().int().min(1).max(24).default(1),
  notes:        z.string().max(500).optional(),
  couponId:     z.string().optional(),
  discountApplied: z.number().min(0).optional().default(0),
});

export const POST = withRoute<{ id: string }>(
  { route: "POST /api/superadmin/subscriptions/[id]/activate", rateLimit: RATE_LIMITS.WRITE, skipSubscriptionCheck: true },
  async (req, { session, db, log }, { id }) => {
    if (!await isSuperAdmin(db, session.userId)) return apiError("Forbidden", 403);
    if (!await requireSuperadminToken(req, session.userId)) {
      log.security("Superadmin route accessed without valid superadmin session token", {});
      return apiError("Superadmin session token required. Call POST /api/superadmin/auth first.", 401);
    }

    const body = schema.parse(await req.json());

    const [plan] = await db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.slug, body.planSlug))
      .limit(1);

    if (!plan) return apiError("Plan not found", 404);

    const now   = Date.now();
    const end   = now + body.months * 30 * 86_400_000;

    await db.update(subscriptions).set({
      planId:             plan.id,
      status:             "active",
      currentPeriodStart: now,
      currentPeriodEnd:   end,
      trialEndAt:         null,
      notes:              body.notes ?? null,
      couponId:           body.couponId ?? null,
      discountApplied:    body.discountApplied ?? 0,
      cancelledAt:        null,
      updatedAt:          now,
    }).where(eq(subscriptions.id, id));

    await logSuperadminAction(session.userId, "ACTIVATE_SUBSCRIPTION", { subscriptionId: id, planSlug: body.planSlug, months: body.months });
    return apiOk({ activated: true, planSlug: body.planSlug, expiresAt: end });
  }
);
