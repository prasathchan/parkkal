import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { patients, organizationPatients, appointments, treatments, visitTreatments, prescriptions, invoices, invoiceTreatments, visits, visitItems, payments, attachments, emergencyContacts, consentAuditLog } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { encryptField, decryptField } from "@/lib/encryption";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const WRITE_RATE_LIMIT = { limit: 120, windowMs: 60_000 };
const DESTRUCTIVE_RATE_LIMIT = { limit: 10, windowMs: 60_000 };

const updatePatientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  address: z.string().max(500).optional(),
  medicalHistory: z.string().max(5000).optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional().nullable(),
  panNumber: z.string().max(10).optional().nullable(),
  aadhaarNumber: z.string().max(12).optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("GET /api/patients/[id]", session);
  if (!await hasPermission(session, PERMISSIONS.PATIENTS_VIEW)) {
    log.security("Permission denied: patients.view", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  // PAN and Aadhaar are Indian national IDs equivalent to SSN.
  // Only ADMIN may see them in the detail view; all other roles receive null.
  if (session.role === "ADMIN") {
    const decrypted = {
      ...patient,
      panNumber: await decryptField(patient.panNumber) ?? null,
      aadhaarNumber: await decryptField(patient.aadhaarNumber) ?? null,
    };
    return NextResponse.json({ patient: decrypted });
  }
  return NextResponse.json({ patient: { ...patient, panNumber: null, aadhaarNumber: null } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`write:${session.userId}`, WRITE_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const log = logger.forRoute("PATCH /api/patients/[id]", session);
  const { id } = await params;
  if (!await hasPermission(session, PERMISSIONS.PATIENTS_EDIT)) {
    log.security("Permission denied: patients.edit", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = getDb();

    const orgLink = (await db.select().from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, id))))[0];
    if (!orgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const data = updatePatientSchema.parse(body);

    // Non-ADMIN roles may not overwrite government IDs
    if (session.role !== "ADMIN") {
      delete (data as Partial<typeof data>).panNumber;
      delete (data as Partial<typeof data>).aadhaarNumber;
    }

    // Encrypt government IDs before persisting
    const updatePayload = {
      ...data,
      panNumber: data.panNumber !== undefined ? (await encryptField(data.panNumber) ?? null) : undefined,
      aadhaarNumber: data.aadhaarNumber !== undefined ? (await encryptField(data.aadhaarNumber) ?? null) : undefined,
      updatedAt: Date.now(),
    };

    await db.update(patients).set(updatePayload).where(eq(patients.id, id));
    const updated = (await db.select().from(patients).where(eq(patients.id, id)))[0];
    if (session.role === "ADMIN") {
      const decrypted = {
        ...updated,
        panNumber: await decryptField(updated.panNumber) ?? null,
        aadhaarNumber: await decryptField(updated.aadhaarNumber) ?? null,
      };
      return NextResponse.json({ patient: decrypted });
    }
    log.info("Patient updated", { patientId: id });
    return NextResponse.json({ patient: { ...updated, panNumber: null, aadhaarNumber: null } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    log.error("Failed to update patient", error, { patientId: id });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`destructive:${session.userId}`, DESTRUCTIVE_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const log = logger.forRoute("DELETE /api/patients/[id]", session);
  if (session.role !== "ADMIN") {
    log.security("Permission denied: only ADMIN can delete patients", { role: session.role });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  const orgLink = (await db.select().from(organizationPatients)
    .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, id))))[0];
  if (!orgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Phase 1: collect IDs for child rows that need sub-cascades (reads outside transaction)
  const patientVisits = await db.select({ id: visits.id }).from(visits).where(eq(visits.patientId, id));
  const visitIds = patientVisits.map((v: { id: string }) => v.id);
  const patientInvoices = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.patientId, id));
  const invoiceIds = patientInvoices.map((inv: { id: string }) => inv.id);
  const patientTreatments = await db.select({ id: treatments.id }).from(treatments).where(eq(treatments.patientId, id));
  const treatmentIds = patientTreatments.map((t: { id: string }) => t.id);

  // Phase 2: cascade delete (sequential — avoids D1 transaction batch API limitations)
  for (const vid of visitIds) {
    await db.delete(visitTreatments).where(eq(visitTreatments.visitId, vid));
    await db.delete(prescriptions).where(eq(prescriptions.visitId, vid));
    await db.delete(attachments).where(eq(attachments.visitId, vid));
    await db.delete(payments).where(eq(payments.visitId, vid));
    await db.delete(visitItems).where(eq(visitItems.visitId, vid));
  }
  await db.delete(visits).where(eq(visits.patientId, id));

  for (const iid of invoiceIds) {
    await db.delete(invoiceTreatments).where(eq(invoiceTreatments.invoiceId, iid));
  }
  await db.delete(invoices).where(eq(invoices.patientId, id));

  // visitTreatments for treatments not already cleaned via visits
  for (const tid of treatmentIds) {
    await db.delete(visitTreatments).where(eq(visitTreatments.treatmentId, tid));
    await db.delete(consentAuditLog).where(eq(consentAuditLog.treatmentId, tid));
  }
  await db.delete(treatments).where(eq(treatments.patientId, id));
  await db.delete(appointments).where(eq(appointments.patientId, id));
  await db.delete(emergencyContacts).where(and(eq(emergencyContacts.entityId, id), eq(emergencyContacts.entityType, "PATIENT")));
  await db.delete(organizationPatients).where(eq(organizationPatients.patientId, id));
  await db.delete(patients).where(eq(patients.id, id));

  log.info("Patient deleted", { patientId: id });
  return NextResponse.json({ success: true });
}
