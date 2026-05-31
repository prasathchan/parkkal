import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { payments, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
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
  const body = await request.json();
  const { amount, paymentMethod, referenceNumber, notes, patientId } = body;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
  }
  if (!patientId) {
    return NextResponse.json({ error: "patientId is required" }, { status: 400 });
  }

  const db = getDb();

  // Get current visit
  const [visit] = await db.select().from(visits).where(eq(visits.id, id));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.organizationId !== session.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const newTotal = visit.paidAmount + Number(amount);
  if (newTotal > visit.totalAmount + 0.001) {
    return NextResponse.json({ error: `Payment exceeds balance. Due: ₹${(visit.totalAmount - visit.paidAmount).toFixed(2)}` }, { status: 400 });
  }

  const newPayment = {
    id: crypto.randomUUID(),
    visitId: id,
    patientId,
    amount: Number(amount),
    paymentMethod: (paymentMethod || "CASH") as "CASH" | "CARD" | "UPI" | "BANK_TRANSFER",
    referenceNumber: referenceNumber || null,
    notes: notes || null,
    paidAt: Date.now(),
    recordedBy: session.userId,
  };

  await db.insert(payments).values(newPayment);

  // Update visit paidAmount and possibly status
  const isFullyPaid = newTotal >= visit.totalAmount - 0.001;
  await db.update(visits).set({
    paidAmount: newTotal,
    status: isFullyPaid ? "COMPLETED" : visit.status,
    updatedAt: Date.now(),
  }).where(eq(visits.id, id));

  return NextResponse.json({ payment: newPayment }, { status: 201 });
}
