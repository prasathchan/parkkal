import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { payments, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const createPaymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  paymentMethod: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]).default("CASH"),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const [visit] = await db
    .select({ organizationId: visits.organizationId })
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const rows = await db.select().from(payments).where(eq(payments.visitId, id));
  return NextResponse.json({ payments: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.errors }, { status: 400 });
  }

  const { amount, paymentMethod, referenceNumber, notes } = parsed.data;
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

  const newPayment = {
    id: crypto.randomUUID(),
    visitId: id,
    patientId: visit.patientId,
    amount,
    paymentMethod,
    referenceNumber: referenceNumber || null,
    notes: notes || null,
    paidAt: Date.now(),
    recordedBy: session.userId,
  };

  await db.insert(payments).values(newPayment);

  // Recompute paidAmount from SUM of all payment records — self-healing against drift.
  // A CASE-based incremental update is not race-safe: two concurrent requests can both
  // pass the balance check on a stale read, INSERT their records, but only one increment
  // applies. SUM recompute is always authoritative regardless of concurrency.
  await db
    .update(visits)
    .set({
      paidAmount: sql`MIN(total_amount, (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE visit_id = ${id}))`,
      updatedAt: Date.now(),
    })
    .where(eq(visits.id, id));

  // Intentionally NOT auto-completing the visit on full payment.
  // Clinical completion must be an explicit doctor action, not a financial side-effect.

  return NextResponse.json({ payment: newPayment }, { status: 201 });
}
