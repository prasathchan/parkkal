/**
 * PATCH /api/visits/[id]/payments/[paymentId]
 *
 * Void a payment. Only ADMIN or users with billing.override permission can void.
 * Voiding re-computes the visit's paidAmount excluding the voided record.
 *
 * Body: { voidReason: string }
 */
import { eq, and, sql } from "drizzle-orm";
import { payments, visits } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const voidSchema = z.object({
  voidReason: z.string().min(3, "Please provide a reason").max(500),
});

export const PATCH = withRoute<{ id: string; paymentId: string }>(
  { route: "PATCH /api/visits/[id]/payments/[paymentId]", rateLimit: RATE_LIMITS.DESTRUCTIVE, permission: PERMISSIONS.BILLING_CREATE },
  async (req, { session, db, log }, { id, paymentId }) => {
    const canVoid = session.role === "ADMIN" || (session.permissions ?? []).includes("billing.override");
    if (!canVoid) return apiError("Voiding payments requires billing override permission. Contact an admin.", 403);

    const [visit] = await db
      .select({ organizationId: visits.organizationId, status: visits.status })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Visit not found", 404);

    const [payment] = await db
      .select({ id: payments.id, amount: payments.amount, voidedAt: payments.voidedAt })
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.visitId, id)));
    if (!payment) return apiError("Payment not found", 404);
    if (payment.voidedAt) return apiError("Payment is already voided", 409);

    let body: unknown;
    try { body = await req.json(); } catch { return apiError("Invalid JSON", 400); }

    const parsed = voidSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400);

    const now = Date.now();

    await db
      .update(payments)
      .set({ voidedAt: now, voidedBy: session.userId, voidReason: parsed.data.voidReason })
      .where(eq(payments.id, paymentId));

    // Recompute paidAmount excluding voided payments
    await db
      .update(visits)
      .set({
        paidAmount: sql`MIN(total_amount, (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE visit_id = ${id} AND voided_at IS NULL))`,
        updatedAt: now,
      })
      .where(eq(visits.id, id));

    log.info("Payment voided", { visitId: id, paymentId, voidReason: parsed.data.voidReason });
    return apiOk({ success: true, voidedAt: now });
  }
);
