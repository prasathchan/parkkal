/**
 * API Route: /api/visits/[id]/payments
 *
 * GET  — List all payments recorded for a visit
 * POST — Record a new payment (updates visit.paidAmount automatically)
 *
 * Payment methods: CASH | CARD | UPI | BANK_TRANSFER
 *
 * NOTE: Payments are append-only. There is no DELETE — to void a payment,
 * contact the ADMIN who can use database-level corrections if necessary.
 *
 * Who can call this: billing.view (GET) / billing.create (POST)
 */
import { eq, and, sql } from "drizzle-orm";
import { payments, visits, visitTreatments, treatments } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const createPaymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  paymentMethod: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]).default("CASH"),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  treatmentId: z.string().optional().nullable(),
  allowOverpayment: z.boolean().optional().default(false),
});

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/visits/[id]/payments", permission: PERMISSIONS.BILLING_VIEW },
  async (_req, { session, db }, { id }) => {
    const [visit] = await db
      .select({ organizationId: visits.organizationId })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Visit not found", 404);

    const rows = await db
      .select({
        id: payments.id,
        visitId: payments.visitId,
        patientId: payments.patientId,
        treatmentId: payments.treatmentId,
        treatmentDescription: treatments.description,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        referenceNumber: payments.referenceNumber,
        notes: payments.notes,
        paidAt: payments.paidAt,
        recordedBy: payments.recordedBy,
      })
      .from(payments)
      .leftJoin(treatments, eq(payments.treatmentId, treatments.id))
      .where(eq(payments.visitId, id));

    return apiOk({ payments: rows });
  }
);

export const POST = withRoute<{ id: string }>(
  { route: "POST /api/visits/[id]/payments", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.BILLING_CREATE },
  async (req, { session, db, log }, { id }) => {
    const parsed = createPaymentSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Invalid input", 400);

    const { amount, paymentMethod, referenceNumber, notes, treatmentId, allowOverpayment } = parsed.data;

    const [visit] = await db
      .select()
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Visit not found", 404);

    if (visit.status === "CANCELLED") return apiError("Cannot add payment to a cancelled visit", 400);

    const due = visit.totalAmount - visit.paidAmount;
    if (due <= 0.001) return apiError("Visit is already fully paid", 400);

    if (amount > due + 0.001 && !allowOverpayment) {
      return apiError(`Payment of ₹${amount.toFixed(2)} exceeds balance due of ₹${due.toFixed(2)}`, 400);
    }

    // Validate treatmentId is linked to this visit
    if (treatmentId) {
      const [link] = await db
        .select({ treatmentId: visitTreatments.treatmentId })
        .from(visitTreatments)
        .where(and(eq(visitTreatments.visitId, id), eq(visitTreatments.treatmentId, treatmentId)));
      if (!link) return apiError("Treatment plan is not linked to this visit", 422);
    }

    const newPayment = {
      id: crypto.randomUUID(),
      visitId: id,
      patientId: visit.patientId,
      treatmentId: treatmentId || null,
      amount,
      paymentMethod,
      referenceNumber: referenceNumber || null,
      notes: notes || null,
      paidAt: Date.now(),
      recordedBy: session.userId,
    };

    await db.insert(payments).values(newPayment);

    // Recompute paidAmount from SUM of all payment records — self-healing against drift.
    await db
      .update(visits)
      .set({
        paidAmount: sql`MIN(total_amount, (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE visit_id = ${id}))`,
        updatedAt: Date.now(),
      })
      .where(eq(visits.id, id));

    // Intentionally NOT auto-completing the visit on full payment.
    // Clinical completion must be an explicit doctor action, not a financial side-effect.
    log.info("Payment recorded", { visitId: id, paymentId: newPayment.id, amount, paymentMethod });
    return apiOk({ payment: newPayment }, 201);
  }
);
