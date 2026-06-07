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
import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { payments, visits, visitTreatments, treatments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const WRITE_RATE_LIMIT = { limit: 120, windowMs: 60_000 };

const createPaymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  paymentMethod: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]).default("CASH"),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  treatmentId: z.string().optional().nullable(), // null = general; set = attributed to treatment plan
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await hasPermission(session, PERMISSIONS.BILLING_VIEW)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const log = logger.forRoute("GET /api/visits/[id]/payments", session);
  const { id } = await params;

  try {
  const db = getDb();
  const [visit] = await db
    .select({ organizationId: visits.organizationId })
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

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

  return NextResponse.json({ payments: rows });
  } catch (err) {
    log.error("Failed to fetch payments", err, { visitId: id });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`write:${session.userId}`, WRITE_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  if (!await hasPermission(session, PERMISSIONS.BILLING_CREATE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const log = logger.forRoute("POST /api/visits/[id]/payments", session);
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    log.warn("Malformed JSON body", { visitId: id, error: String(err) });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.errors }, { status: 400 });
  }

  const { amount, paymentMethod, referenceNumber, notes, treatmentId } = parsed.data;
  const db = getDb();

  const [visit] = await db
    .select()
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  if (visit.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot add payment to a cancelled visit" }, { status: 400 });
  }

  const due = visit.totalAmount - visit.paidAmount;
  if (due <= 0.001) {
    return NextResponse.json({ error: "Visit is already fully paid" }, { status: 400 });
  }

  if (amount > due + 0.001) {
    return NextResponse.json(
      { error: `Payment of ₹${amount.toFixed(2)} exceeds balance due of ₹${due.toFixed(2)}` },
      { status: 400 }
    );
  }

  // Validate treatmentId is linked to this visit
  if (treatmentId) {
    const [link] = await db
      .select({ treatmentId: visitTreatments.treatmentId })
      .from(visitTreatments)
      .where(and(eq(visitTreatments.visitId, id), eq(visitTreatments.treatmentId, treatmentId)));
    if (!link) {
      return NextResponse.json({ error: "Treatment plan is not linked to this visit" }, { status: 422 });
    }
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

  try {
    await db.insert(payments).values(newPayment);

    // Recompute paidAmount from SUM of all payment records — self-healing against drift.
    await db
      .update(visits)
      .set({
        paidAmount: sql`MIN(total_amount, (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE visit_id = ${id}))`,
        updatedAt: Date.now(),
      })
      .where(eq(visits.id, id));
  } catch (err) {
    log.error("Failed to insert payment", err, { visitId: id, amount, paymentMethod });
    return NextResponse.json({ error: "Failed to record payment. Please try again." }, { status: 500 });
  }

  // Intentionally NOT auto-completing the visit on full payment.
  // Clinical completion must be an explicit doctor action, not a financial side-effect.
  log.info("Payment recorded", { visitId: id, paymentId: newPayment.id, amount, paymentMethod });
  return NextResponse.json({ payment: newPayment }, { status: 201 });
}
