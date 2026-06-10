import { eq, and } from "drizzle-orm";
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
import { PERMISSIONS } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { runCascade } from "@/lib/db";
import { updateVisitSchema } from "@/lib/schemas";

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/visits/[id]", permission: PERMISSIONS.VISITS_VIEW },
  async (_req, { session, db }, { id }) => {
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
        recallDate: visits.recallDate,
        recallNotes: visits.recallNotes,
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

    if (!visitRow) return apiError("Visit not found", 404);

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

    return apiOk({
      visit: visitRow,
      items,
      payments: paymentRows,
      attachments: attachmentRows,
      prescriptions: prescriptionRows,
    });
  }
);

export const PATCH = withRoute<{ id: string }>(
  { route: "PATCH /api/visits/[id]", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.VISITS_EDIT },
  async (req, { session, db, log }, { id }) => {
    const [existingVisit] = await db
      .select({ appointmentId: visits.appointmentId })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!existingVisit) return apiError("Visit not found", 404);

    // updateVisitSchema uses .strict() — unknown keys are rejected automatically (400).
    // withRoute() catches ZodError and returns 400 with field-level details.
    const body = updateVisitSchema.parse(await req.json());

    // Clinical fields (diagnosis, doctorNotes, status) are restricted to DOCTOR and ADMIN.
    // This is a business rule on top of the permission check — even staff with VISITS_EDIT
    // cannot change clinical records unless they are a doctor or admin.
    const CLINICAL_FIELDS = ["diagnosis", "doctorNotes", "status"] as const;
    const hasClinicalChange = CLINICAL_FIELDS.some((f) => f in body && body[f] !== undefined);
    if (hasClinicalChange && session.role !== "DOCTOR" && session.role !== "ADMIN") {
      log.security("Permission denied: clinical changes require DOCTOR/ADMIN role", { role: session.role });
      return apiError("Only doctors and admins can update clinical records", 403);
    }

    // Build the update payload — only include keys that were actually sent.
    // Zod .strict() already stripped unknown keys, so `body` is safe to spread.
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) updates[key] = value;
    }

    await db.update(visits).set(updates).where(
      and(eq(visits.id, id), eq(visits.organizationId, session.orgId))
    );

    if (body.status === "COMPLETED" && existingVisit.appointmentId) {
      await db
        .update(appointments)
        .set({ status: "COMPLETED" })
        .where(and(
          eq(appointments.id, existingVisit.appointmentId),
          eq(appointments.organizationId, session.orgId)
        ));
    }

    const [updated] = await db.select().from(visits).where(
      and(eq(visits.id, id), eq(visits.organizationId, session.orgId))
    );
    log.info("Visit updated", { visitId: id, updatedFields: Object.keys(updates).filter(k => k !== "updatedAt") });
    return apiOk({ visit: updated });
  }
);

export const DELETE = withRoute<{ id: string }>(
  { route: "DELETE /api/visits/[id]", rateLimit: RATE_LIMITS.DESTRUCTIVE, adminOnly: true },
  async (_req, { session, db, log }, { id }) => {
    const [existingVisit] = await db
      .select({ organizationId: visits.organizationId, paidAmount: visits.paidAmount })
      .from(visits)
      .where(eq(visits.id, id));
    if (!existingVisit) return apiError("Visit not found", 404);
    if (existingVisit.organizationId !== session.orgId) return apiError("Forbidden", 403);

    // Block deletion of visits that have recorded payments — financial records must be preserved.
    if (existingVisit.paidAmount > 0) {
      return apiError("Cannot delete a visit with recorded payments. Void the payments first.", 422);
    }

    // Atomic cascade via D1 batch — all-or-nothing on production, sequential in dev.
    await runCascade(db, [
      db.delete(visitTreatments).where(eq(visitTreatments.visitId, id)),
      db.delete(prescriptions).where(eq(prescriptions.visitId, id)),
      db.delete(attachments).where(eq(attachments.visitId, id)),
      db.delete(payments).where(eq(payments.visitId, id)),
      db.delete(visitItems).where(eq(visitItems.visitId, id)),
      db.delete(visits).where(eq(visits.id, id)),
    ]);

    writeAuditLog({ organizationId: session.orgId, actorId: session.userId, actorRole: session.role, action: "VISIT_DELETED", targetType: "visit", targetId: id });
    log.info("Visit deleted", { visitId: id });
    return apiOk({ success: true });
  }
);
