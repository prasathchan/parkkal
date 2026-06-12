/**
 * GET /api/internal/subscriptions/expiring?days=30 — Console S2S only.
 * Subscriptions (trialing or active) whose end falls within the window.
 */

import { eq, inArray } from "drizzle-orm";
import { subscriptions, subscriptionPlans, organizations } from "@/db/schema";
import { withInternalRoute, internalOk } from "@/lib/internal-api";

export const GET = withInternalRoute("GET /api/internal/subscriptions/expiring", async (req, { db }) => {
  const days = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10) || 30, 1), 90);
  const now = Date.now();
  const horizon = now + days * 86_400_000;

  const rows = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      trialEndAt: subscriptions.trialEndAt,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      orgId: organizations.id,
      orgName: organizations.name,
      orgEmail: organizations.email,
      planName: subscriptionPlans.name,
    })
    .from(subscriptions)
    .innerJoin(organizations, eq(subscriptions.organizationId, organizations.id))
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(inArray(subscriptions.status, ["trialing", "active"]));

  type Row = typeof rows[number];
  const expiring = (rows as Row[])
    .map((r) => {
      const endMs = r.status === "trialing" ? r.trialEndAt : r.currentPeriodEnd;
      return endMs && endMs > now && endMs <= horizon
        ? {
            id: r.id,
            orgId: r.orgId,
            orgName: r.orgName,
            orgEmail: r.orgEmail,
            planName: r.planName,
            status: r.status,
            daysRemaining: Math.ceil((endMs - now) / 86_400_000),
          }
        : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  return internalOk({ subscriptions: expiring });
});
