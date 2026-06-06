import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, type DbInstance } from "@/lib/db";
import {
  visits,
  visitItems,
  visitTreatments,
  payments,
  attachments,
  prescriptions,
  patients,
  users,
  appointments,
  treatments,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await hasPermission(session, PERMISSIONS.VISITS_VIEW)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));

  if (!visitRow) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  const [items, paymentRows, attachmentRows, prescriptionRows] = await Promise.all([
    db.select().from(visitItems).where(eq(visitItems.visitId, id)),
    db
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
      .where(eq(payments.visitId, id)),
    db.select().from(attachments).where(eq(attachments.visitId, id)),
    db.select().from(prescriptions).where(eq(prescriptions.visitId, id)),
  ]);

  return NextResponse.json({
    visit: visitRow,
    items,
    payments: paymentRows,
    attachments: attachmentRows,
    prescriptions: prescriptionRows,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await hasPermission(session, PERMISSIONS.VISITS_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  const [existingVisit] = await db
    .select({ appointmentId: visits.appointmentId })
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));

  if (!existingVisit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const body = await request.json() as Record<string, unknown>;

  // Clinical fields (diagnosis, doctorNotes, status) are restricted to DOCTOR and ADMIN.
  // Receptionists and attendants can still update non-clinical metadata if ever needed.
  const CLINICAL_FIELDS = ["diagnosis", "doctorNotes", "status"] as const;
  const hasClinicalChange = CLINICAL_FIELDS.some((f) => f in body);
  if (hasClinicalChange && session.role !== "DOCTOR" && session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only doctors and admins can update clinical records" },
      { status: 403 }
    );
  }

  // Validate status if provided
  const VALID_STATUSES = ["OPEN", "COMPLETED", "CANCELLED"];
  if ("status" in body && !VALID_STATUSES.includes(body.status as string)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (
    "visitDate" in body &&
    (typeof body.visitDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.visitDate))
  ) {
    return NextResponse.json({ error: "visitDate must be YYYY-MM-DD" }, { status: 400 });
  }

  // Validate free-text lengths to prevent oversized payloads.
  const TEXT_LIMITS: Record<string, number> = { chiefComplaint: 500, doctorNotes: 5000, diagnosis: 1000 };
  for (const [field, maxLen] of Object.entries(TEXT_LIMITS)) {
    if (field in body && typeof body[field] === "string" && (body[field] as string).length > maxLen) {
      return NextResponse.json({ error: `${field} exceeds maximum length of ${maxLen}` }, { status: 400 });
    }
  }

  const allowed = ["chiefComplaint", "doctorNotes", "diagnosis", "status", "visitDate"];
  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  await db.update(visits).set(updates).where(
    and(eq(visits.id, id), eq(visits.organizationId, session.orgId))
  );

  // When the doctor explicitly marks a visit as COMPLETED, sync the appointment status.
  if (body.status === "COMPLETED" && existingVisit.appointmentId) {
    await db
      .update(appointments)
      .set({ status: "COMPLETED" })
      .where(
        and(
          eq(appointments.id, existingVisit.appointmentId),
          eq(appointments.organizationId, session.orgId)
        )
      );
  }

  const [updated] = await db.select().from(visits).where(
    and(eq(visits.id, id), eq(visits.organizationId, session.orgId))
  );
  return NextResponse.json({ visit: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only ADMIN can delete visit records — deletion destroys clinical history.
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can delete visits" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  const [existingVisit] = await db
    .select({ organizationId: visits.organizationId })
    .from(visits)
    .where(eq(visits.id, id));
  if (!existingVisit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (existingVisit.organizationId !== session.orgId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.transaction(async (tx: DbInstance) => {
    await tx.delete(visitTreatments).where(eq(visitTreatments.visitId, id));
    await tx.delete(prescriptions).where(eq(prescriptions.visitId, id));
    await tx.delete(attachments).where(eq(attachments.visitId, id));
    await tx.delete(payments).where(eq(payments.visitId, id));
    await tx.delete(visitItems).where(eq(visitItems.visitId, id));
    await tx.delete(visits).where(eq(visits.id, id));
  });

  return NextResponse.json({ success: true });
}
