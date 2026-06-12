import { eq, desc } from "drizzle-orm";
type SubRow = {
  id: string; status: string; trialEndAt: number | null; currentPeriodEnd: number | null;
  notes: string | null; cancelledAt: number | null; createdAt: number;
  planName: string; planSlug: string; priceMonthly: number;
  orgId: string; orgName: string; orgSlug: string; orgEmail: string | null;
};
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { subscriptions, subscriptionPlans, organizations } from "@/db/schema";
import { isSuperAdmin } from "@/lib/superadmin";

export const GET = withRoute(
  { route: "GET /api/superadmin/subscriptions", rateLimit: RATE_LIMITS.READ, skipSubscriptionCheck: true },
  async (_req, { session, db }) => {
    if (!await isSuperAdmin(db, session.userId)) return apiError("Forbidden", 403);

    const rows = await db
      .select({
        id:               subscriptions.id,
        status:           subscriptions.status,
        trialEndAt:       subscriptions.trialEndAt,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        notes:            subscriptions.notes,
        cancelledAt:      subscriptions.cancelledAt,
        createdAt:        subscriptions.createdAt,
        planName:         subscriptionPlans.name,
        planSlug:         subscriptionPlans.slug,
        priceMonthly:     subscriptionPlans.priceMonthly,
        orgId:            organizations.id,
        orgName:          organizations.name,
        orgSlug:          organizations.slug,
        orgEmail:         organizations.email,
      })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .innerJoin(organizations, eq(subscriptions.organizationId, organizations.id))
      .orderBy(desc(subscriptions.createdAt));

    const now = Date.now();
    const enriched = (rows as SubRow[]).map((r) => {
      const endMs = r.status === "trialing" ? r.trialEndAt : r.currentPeriodEnd;
      const daysRemaining = endMs ? Math.ceil((endMs - now) / 86_400_000) : null;
      return { ...r, daysRemaining };
    });

    return apiOk({ subscriptions: enriched });
  }
);
