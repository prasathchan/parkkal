import { eq, and } from "drizzle-orm";
import { patients, organizationPatients, appointments, treatments, visitTreatments, prescriptions, invoices, invoiceTreatments, visits, visitItems, payments, attachments, emergencyContacts, consentAuditLog } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog, logPatientAccess } from "@/lib/audit";
import { encryptField, decryptField } from "@/lib/encryption";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { runCascade } from "@/lib/db";
import { z } from "zod";

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

/** GET /api/patients/[id] — fetch patient (ADMIN sees decrypted govt IDs, others get null) */
export const GET = withRoute<{ id: string }>(
  { route: "GET /api/patients/[id]", permission: PERMISSIONS.PATIENTS_VIEW },
  async (_req, { session, db }, { id }) => {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    if (!patient) return apiError("Patient not found", 404);

    const [orgLink] = await db.select().from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, id)));
    if (!orgLink) return apiError("Forbidden", 403);

    logPatientAccess({ organizationId: session.orgId, actorId: session.userId, patientId: id, accessType: "PROFILE", route: "GET /api/patients/[id]" });

    const base = {
      ...patient,
      dateOfBirth:    await decryptField(patient.dateOfBirth) ?? null,
      address:        await decryptField(patient.address) ?? null,
      medicalHistory: await decryptField(patient.medicalHistory) ?? null,
    };

    // PAN and Aadhaar: only ADMIN may see them.
    if (session.role === "ADMIN") {
      return apiOk({ patient: {
        ...base,
        panNumber:    await decryptField(patient.panNumber) ?? null,
        aadhaarNumber: await decryptField(patient.aadhaarNumber) ?? null,
      }});
    }
    return apiOk({ patient: { ...base, panNumber: null, aadhaarNumber: null } });
  }
);

/** PATCH /api/patients/[id] — update patient details */
export const PATCH = withRoute<{ id: string }>(
  { route: "PATCH /api/patients/[id]", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.PATIENTS_EDIT },
  async (req, { session, db, log }, { id }) => {
    const [orgLink] = await db.select().from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, id)));
    if (!orgLink) return apiError("Forbidden", 403);

    const data = updatePatientSchema.parse(await req.json());

    // Non-ADMIN roles may not overwrite government IDs
    if (session.role !== "ADMIN") {
      delete (data as Partial<typeof data>).panNumber;
      delete (data as Partial<typeof data>).aadhaarNumber;
    }

    const updatePayload = {
      ...data,
      dateOfBirth:    data.dateOfBirth    !== undefined ? (await encryptField(data.dateOfBirth) ?? null)    : undefined,
      address:        data.address        !== undefined ? (await encryptField(data.address) ?? null)        : undefined,
      medicalHistory: data.medicalHistory !== undefined ? (await encryptField(data.medicalHistory) ?? null) : undefined,
      panNumber:      data.panNumber      !== undefined ? (await encryptField(data.panNumber) ?? null)      : undefined,
      aadhaarNumber:  data.aadhaarNumber  !== undefined ? (await encryptField(data.aadhaarNumber) ?? null)  : undefined,
      updatedAt: Date.now(),
    };

    await db.update(patients).set(updatePayload).where(eq(patients.id, id));
    const [updated] = await db.select().from(patients).where(eq(patients.id, id));

    const base = {
      ...updated,
      dateOfBirth:    await decryptField(updated.dateOfBirth) ?? null,
      address:        await decryptField(updated.address) ?? null,
      medicalHistory: await decryptField(updated.medicalHistory) ?? null,
    };

    if (session.role === "ADMIN") {
      return apiOk({ patient: {
        ...base,
        panNumber:    await decryptField(updated.panNumber) ?? null,
        aadhaarNumber: await decryptField(updated.aadhaarNumber) ?? null,
      }});
    }
    log.info("Patient updated", { patientId: id });
    return apiOk({ patient: { ...base, panNumber: null, aadhaarNumber: null } });
  }
);

/** DELETE /api/patients/[id]?confirm=erase — cascade-erase all patient data (ADMIN only, DPDP right to erasure) */
export const DELETE = withRoute<{ id: string }>(
  { route: "DELETE /api/patients/[id]", rateLimit: RATE_LIMITS.DESTRUCTIVE, adminOnly: true },
  async (req, { session, db, log }, { id }) => {
    const confirm = new URL(req.url).searchParams.get("confirm");
    if (confirm !== "erase") return apiError("Add ?confirm=erase to confirm permanent data erasure", 400);

    const [orgLink] = await db.select().from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, id)));
    if (!orgLink) return apiError("Forbidden", 403);

    // Phase 1: collect child IDs that need sub-cascades
    const patientVisits: { id: string }[] = await db.select({ id: visits.id }).from(visits).where(eq(visits.patientId, id));
    const visitIds = patientVisits.map((v) => v.id);
    const patientInvoices: { id: string }[] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.patientId, id));
    const invoiceIds = patientInvoices.map((inv) => inv.id);
    const patientTreatments: { id: string }[] = await db.select({ id: treatments.id }).from(treatments).where(eq(treatments.patientId, id));
    const treatmentIds = patientTreatments.map((t) => t.id);

    // Phase 2: build the full cascade as a flat list of delete builders,
    // then run atomically via D1 batch (sequential fallback in dev).
    // Order is child-before-parent so FK-like integrity is maintained.
    const cascadeOps = [
      // Visit children
      ...visitIds.flatMap((vid) => [
        db.delete(visitTreatments).where(eq(visitTreatments.visitId, vid)),
        db.delete(prescriptions).where(eq(prescriptions.visitId, vid)),
        db.delete(attachments).where(eq(attachments.visitId, vid)),
        db.delete(payments).where(eq(payments.visitId, vid)),
        db.delete(visitItems).where(eq(visitItems.visitId, vid)),
      ]),
      db.delete(visits).where(eq(visits.patientId, id)),

      // Invoice children
      ...invoiceIds.map((iid) =>
        db.delete(invoiceTreatments).where(eq(invoiceTreatments.invoiceId, iid))
      ),
      db.delete(invoices).where(eq(invoices.patientId, id)),

      // Treatment children
      ...treatmentIds.flatMap((tid) => [
        db.delete(visitTreatments).where(eq(visitTreatments.treatmentId, tid)),
        db.delete(consentAuditLog).where(eq(consentAuditLog.treatmentId, tid)),
      ]),
      db.delete(treatments).where(eq(treatments.patientId, id)),

      // Remaining patient rows
      db.delete(appointments).where(eq(appointments.patientId, id)),
      db.delete(emergencyContacts).where(and(eq(emergencyContacts.entityId, id), eq(emergencyContacts.entityType, "PATIENT"))),
      db.delete(organizationPatients).where(eq(organizationPatients.patientId, id)),
      db.delete(patients).where(eq(patients.id, id)),
    ];

    await runCascade(db, cascadeOps);

    writeAuditLog({ organizationId: session.orgId, actorId: session.userId, actorRole: session.role, action: "PATIENT_DELETED", targetType: "patient", targetId: id, metadata: { reason: "right-to-erasure", compliance: "DPDP Act 2023" } });
    log.info("Patient data erased", { patientId: id });
    return apiOk({ success: true });
  }
);
