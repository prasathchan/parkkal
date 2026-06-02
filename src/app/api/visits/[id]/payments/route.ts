import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
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
  const [visit] = await db.select({ organizationId: visits.organizationId }).from(visits).where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
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
  const [visit] = await db.select().from(visits).where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  if (visit.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot add payment to a cancelled visit" }, { status: 400 });
  }

  const due = visit.totalAmount - visit.paidAmount;
  if (due <= 0.001) {
    return NextResponse.json({ error: "Visit is already fully paid" }, { status: 400 });
  }

  const newTotal = visit.paidAmount + amount;
  if (newTotal > visit.totalAmount + 0.001) {
    return NextResponse.json({ error: `Payment of ₹${amount.toFixed(2)} exceeds balance due of ₹${due.toFixed(2)}` }, { status: 400 });
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

  const isFullyPaid = newTotal >= visit.totalAmount - 0.001;
  await db.update(visits).set({
    paidAmount: newTotal,
    status: isFullyPaid ? "COMPLETED" : visit.status,
    updatedAt: Date.now(),
  }).where(eq(visits.id, id));

  if (isFullyPaid && visit.appointmentId) {
    await db.update(appointments)
      .set({ status: "COMPLETED" })
      .where(and(eq(appointments.id, visit.appointmentId), eq(appointments.organizationId, session.orgId)));
  }

  return NextResponse.json({ payment: newPayment }, { status: 201 });
}
