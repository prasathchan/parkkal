import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { patients, organizationPatients, appointments, treatments, prescriptions, invoices, invoiceTreatments, visits, visitItems, payments, attachments, emergencyContacts } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const updatePatientSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  address: z.string().optional(),
  medicalHistory: z.string().optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional().nullable(),
  panNumber: z.string().optional().nullable(),
  aadhaarNumber: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const patient = (await db.select().from(patients).where(eq(patients.id, id)))[0];

  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const orgLink = (await db
    .select()
    .from(organizationPatients)
    .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, patient.id)))
  )[0];

  if (!orgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ patient });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const db = getDb();

    const orgLink = (await db.select().from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, id))))[0];
    if (!orgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const data = updatePatientSchema.parse(body);

    await db.update(patients).set({ ...data, updatedAt: Date.now() }).where(eq(patients.id, id));
    const updated = (await db.select().from(patients).where(eq(patients.id, id)))[0];
    return NextResponse.json({ patient: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    console.error("Update patient error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = getDb();

  const orgLink = (await db.select().from(organizationPatients)
    .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, id))))[0];
  if (!orgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cascadeDelete = async (tx: typeof db) => {
    const patientVisits = await tx.select({ id: visits.id }).from(visits).where(eq(visits.patientId, id));
    for (const v of patientVisits) {
      await tx.delete(prescriptions).where(eq(prescriptions.visitId, v.id));
      await tx.delete(attachments).where(eq(attachments.visitId, v.id));
      await tx.delete(payments).where(eq(payments.visitId, v.id));
      await tx.delete(visitItems).where(eq(visitItems.visitId, v.id));
    }
    await tx.delete(visits).where(eq(visits.patientId, id));

    const patientInvoices = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.patientId, id));
    for (const inv of patientInvoices) {
      await tx.delete(invoiceTreatments).where(eq(invoiceTreatments.invoiceId, inv.id));
    }
    await tx.delete(invoices).where(eq(invoices.patientId, id));

    await tx.delete(treatments).where(eq(treatments.patientId, id));
    await tx.delete(appointments).where(eq(appointments.patientId, id));
    await tx.delete(emergencyContacts).where(eq(emergencyContacts.entityId, id));
    await tx.delete(organizationPatients).where(eq(organizationPatients.patientId, id));
    await tx.delete(patients).where(eq(patients.id, id));
  };

  type DbWithTx = typeof db & { transaction: (fn: (tx: typeof db) => Promise<void>) => Promise<void> };
  if (typeof (db as unknown as { transaction?: unknown }).transaction === "function") {
    await (db as unknown as DbWithTx).transaction(cascadeDelete);
  } else {
    await cascadeDelete(db);
  }

  return NextResponse.json({ success: true });
}
