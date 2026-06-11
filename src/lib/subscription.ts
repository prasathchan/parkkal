/**
 * lib/subscription.ts
 *
 * Subscription state helpers. Imported by withRoute() for enforcement
 * and by dashboard pages for UI gating.
 */

import { eq } from "drizzle-orm";
import { subscriptions, subscriptionPlans } from "@/db/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired";

export interface OrgSubscription {
  id: string;
  status: SubscriptionStatus;
  planName: string;
  planSlug: string;
  priceMonthly: number;
  maxDoctors: number | null;
  maxStaff: number | null;
  trialEndAt: number | null;
  currentPeriodEnd: number | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  notes: string | null;
  /** True if the org can still read data but cannot create/update/delete. */
  isReadOnly: boolean;
  /** True if the subscription is in a usable state (trialing or active). */
  isActive: boolean;
  /** Days remaining in trial or current period. Negative = expired. */
  daysRemaining: number | null;
}

export async function getOrgSubscription(
  db: DrizzleD1Database,
  orgId: string,
): Promise<OrgSubscription | null> {
  const rows = await db
    .select({
      id:                   subscriptions.id,
      status:               subscriptions.status,
      trialEndAt:           subscriptions.trialEndAt,
      currentPeriodEnd:     subscriptions.currentPeriodEnd,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      stripeCustomerId:     subscriptions.stripeCustomerId,
      notes:                subscriptions.notes,
      planName:             subscriptionPlans.name,
      planSlug:             subscriptionPlans.slug,
      priceMonthly:         subscriptionPlans.priceMonthly,
      maxDoctors:           subscriptionPlans.maxDoctors,
      maxStaff:             subscriptionPlans.maxStaff,
    })
    .from(subscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(eq(subscriptions.organizationId, orgId))
    .orderBy(subscriptions.createdAt)
    .limit(1);

  if (!rows.length) return null;

  const row = rows[0];
  const now = Date.now();

  const endMs = row.status === "trialing" ? row.trialEndAt : row.currentPeriodEnd;
  const daysRemaining = endMs ? Math.ceil((endMs - now) / 86_400_000) : null;

  const isActive = row.status === "trialing" || row.status === "active";
  const isExpiredTrial = row.status === "trialing" && daysRemaining !== null && daysRemaining < 0;
  const isExpired = isExpiredTrial || row.status === "expired" || row.status === "cancelled";

  return {
    id:                   row.id,
    status:               isExpiredTrial ? "expired" : (row.status as SubscriptionStatus),
    planName:             row.planName,
    planSlug:             row.planSlug,
    priceMonthly:         row.priceMonthly,
    maxDoctors:           row.maxDoctors,
    maxStaff:             row.maxStaff,
    trialEndAt:           row.trialEndAt,
    currentPeriodEnd:     row.currentPeriodEnd,
    stripeSubscriptionId: row.stripeSubscriptionId,
    stripeCustomerId:     row.stripeCustomerId,
    notes:                row.notes,
    isReadOnly:           isExpired,
    isActive:             isActive && !isExpiredTrial,
    daysRemaining,
  };
}

/** Called on org signup to create a 30-day trial subscription. */
export async function createTrialSubscription(
  db: DrizzleD1Database,
  orgId: string,
): Promise<void> {
  const now = Date.now();
  const trialDays = 30;

  const [trialPlan] = await db
    .select({ id: subscriptionPlans.id })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.slug, "trial"))
    .limit(1);

  if (!trialPlan) return;

  await db.insert(subscriptions).values({
    id:             crypto.randomUUID(),
    organizationId: orgId,
    planId:         trialPlan.id,
    status:         "trialing",
    trialEndAt:     now + trialDays * 86_400_000,
    createdAt:      now,
    updatedAt:      now,
  });
}
