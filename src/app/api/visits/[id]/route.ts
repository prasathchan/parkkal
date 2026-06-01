import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visits, visitItems, payments, attachments, prescriptions, patients, users } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const [visitRow] = await db
    .select({
      id: visits.id,
      visitCode: visits.visitCode,
      patientId: visits.patientId,
      doctorId: visits.doctorId,
      visitDate: visits.visitDate,
      chiefComplaint: visits.chiefComplaint,
      doctorNotes: visits.doctorNotes,
      diagnosis: visits.diagnosis,
      status: visits.status,
      totalAmount: visits.totalAmount,
      paidAmount: visits.paidAmount,
      appointmentId: visits.appointmentId,
      visitType: visits.visitType,
      createdAt: visits.createdAt,
      updatedAt: visits.updatedAt,
      organizationId: visits.organizationId,
      patientName: patients.name,
      patientCode: patients.patientCode,
      doctorName: users.name,
    })
    .from(visits)
    .leftJoin(patients, eq(visits.patientId, patients.id))
    .leftJoin(users, eq(visits.doctorId, users.id))
    .where(eq(visits.id, id));

  if (!visitRow) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  if (visitRow.organizationId !== session.orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await db.select().from(visitItems).where(eq(visitItems.visitId, id));
  const paymentRows = await db.select().from(payments).where(eq(payments.visitId, id));
  const attachmentRows = await db.select().from(attachments).where(eq(attachments.visitId, id));

  return NextResponse.json({ visit: visitRow, items, payments: paymentRows, attachments: attachmentRows });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const [existingVisit] = await db.select({ organizationId: visits.organizationId }).from(visits).where(eq(visits.id, id));
  if (!existingVisit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (existingVisit.organizationId !== session.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();

  const allowed = ["chiefComplaint", "doctorNotes", "diagnosis", "status", "visitDate"];
  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  await db.update(visits).set(updates).where(eq(visits.id, id));
  const [updated] = await db.select().from(visits).where(eq(visits.id, id));
  return NextResponse.json({ visit: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const [existingVisit] = await db.select({ organizationId: visits.organizationId }).from(visits).where(eq(visits.id, id));
  if (!existingVisit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (existingVisit.organizationId !== session.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(prescriptions).where(eq(prescriptions.visitId, id));
  await db.delete(attachments).where(eq(attachments.visitId, id));
  await db.delete(payments).where(eq(payments.visitId, id));
  await db.delete(visitItems).where(eq(visitItems.visitId, id));
  await db.delete(visits).where(eq(visits.id, id));

  return NextResponse.json({ success: true });
}
