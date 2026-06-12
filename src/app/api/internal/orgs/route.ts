/**
 * GET /api/internal/orgs — all organisations with their subscription summary.
 * Pricing Console S2S only (Bearer INTERNAL_API_KEY).
 */

import { eq, desc } from "drizzle-orm";
import { organizations, subscriptions, subscriptionPlans } from "@/db/schema";
import { withInternalRoute, internalOk } from "@/lib/internal-api";

export const GET = withInternalRoute("GET /api/internal/orgs", async (_req, { db }) => {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      email: organizations.email,
      phone: organizations.phone,
      createdAt: organizations.createdAt,
      subId: subscriptions.id,
      subStatus: subscriptions.status,
      planSlug: subscriptionPlans.slug,
      planName: subscriptionPlans.name,
      priceMonthly: subscriptionPlans.priceMonthly,
      trialEndAt: subscriptions.trialEndAt,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(organizations)
    .leftJoin(subscriptions, eq(subscriptions.organizationId, organizations.id))
    .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .orderBy(desc(organizations.createdAt));

  const now = Date.now();
  type Row = typeof rows[number];
  const orgs = (rows as Row[]).map((r) => {
    let subscription = null;
    if (r.subId) {
      const endMs = r.subStatus === "trialing" ? r.trialEndAt : r.currentPeriodEnd;
      subscription = {
        id: r.subId,
        status: r.subStatus,
        planSlug: r.planSlug,
        planName: r.planName,
        priceMonthly: r.priceMonthly,
        trialEndAt: r.trialEndAt,
        currentPeriodEnd: r.currentPeriodEnd,
        daysRemaining: endMs ? Math.ceil((endMs - now) / 86_400_000) : null,
      };
    }
    return {
      id: r.id, name: r.name, slug: r.slug, email: r.email, phone: r.phone,
      createdAt: r.createdAt, subscription,
    };
  });

  return internalOk({ orgs });
});
