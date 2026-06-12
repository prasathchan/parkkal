/**
 * POST /api/internal/subscriptions/activate — Console S2S only.
 * Activates (or extends) an org's subscription on a plan for N months,
 * optionally recording a discount. Used by manual cash/NEFT activation and
 * the approved-discount-request flow.
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import { organizations, subscriptions, subscriptionPlans } from "@/db/schema";
import { withInternalRoute, internalOk, internalError } from "@/lib/internal-api";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  orgId: z.string().min(1),
  planSlug: z.string().min(1),
  months: z.number().int().min(1).max(24),
  discountType: z.enum(["percent", "amount"]).optional(),
  discountValue: z.number().min(1).optional(),
  notes: z.string().max(4000).optional(),
});

export const POST = withInternalRoute("POST /api/internal/subscriptions/activate", async (req, { db }) => {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return internalError("Invalid payload", 422);
  const data = parsed.data;

  const [org] = await db.select({ id: organizations.id }).from(organizations)
    .where(eq(organizations.id, data.orgId));
  if (!org) return internalError("Organisation not found", 404);

  const [plan] = await db.select().from(subscriptionPlans)
    .where(eq(subscriptionPlans.slug, data.planSlug));
  if (!plan) return internalError(`Plan "${data.planSlug}" not found`, 404);

  const now = Date.now();

  // Period: extend from the current end if still active, else start now.
  const [existing] = await db.select().from(subscriptions)
    .where(eq(subscriptions.organizationId, data.orgId));
  const base = existing?.currentPeriodEnd && existing.currentPeriodEnd > now && existing.status === "active"
    ? existing.currentPeriodEnd
    : now;
  const end = new Date(base);
  end.setMonth(end.getMonth() + data.months);

  // Discount bookkeeping (informational — price collected off-platform).
  let discountApplied = 0;
  if (data.discountType && data.discountValue) {
    const gross = plan.priceMonthly * data.months;
    discountApplied = data.discountType === "percent"
      ? Math.round((gross * Math.min(data.discountValue, 100)) / 100)
      : Math.min(data.discountValue, gross);
  }

  if (existing) {
    await db.update(subscriptions).set({
      planId: plan.id,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: end.getTime(),
      discountApplied,
      notes: data.notes ?? existing.notes,
      cancelledAt: null,
      updatedAt: now,
    }).where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      organizationId: data.orgId,
      planId: plan.id,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: end.getTime(),
      discountApplied,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  writeAuditLog({
    organizationId: data.orgId,
    actorId: "pricing-console",
    actorRole: "system",
    action: "SUBSCRIPTION_ACTIVATED_VIA_CONSOLE",
    targetType: "subscription",
    targetId: existing?.id ?? null,
    metadata: { planSlug: data.planSlug, months: data.months, discountApplied, notes: data.notes },
  });

  return internalOk({ ok: true, periodEnd: end.getTime(), discountApplied });
});
