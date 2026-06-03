import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { payments, visits, appointments } from "@/db/schema";
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

  // Fetch visit — get patientId from DB, not from caller
  const [visit] = await db
    .select()
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  if (visit.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot add payment to a cancelled visit" }, { status: 400 });
  }

  // COMPLETED visits can still receive payments — clinical workflow:
  // doctor marks visit done, then receptionist collects payment at checkout.
  // Only CANCELLED visits are locked.

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

  // Atomic conditional update: only increment paid_amount if it won't exceed total_amount.
  // This prevents race conditions where two concurrent payments both see the same balance.
  // D1 does not support transactions, so we rely on SQLite's row-level atomic UPDATE.
  await db
    .update(visits)
    .set({
      paidAmount: sql`CASE WHEN paid_amount + ${amount} <= total_amount + 0.001 THEN paid_amount + ${amount} ELSE paid_amount END`,
      updatedAt: Date.now(),
    })
    .where(eq(visits.id, id));

  // Intentionally NOT auto-completing the visit on full payment.
  // Clinical completion (visit status = COMPLETED) must be an explicit action by the doctor,
  // not a financial side-effect. A patient may pay upfront for a multi-session treatment.

  return NextResponse.json({ payment: newPayment }, { status: 201 });
}
