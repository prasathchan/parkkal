import { eq, and, sum } from "drizzle-orm";
import { treatments, visitTreatments, invoiceTreatments, consentAuditLog, visitItems, patients, users } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/treatments/[id]", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.TREATMENTS_VIEW },
  async (_req, { session, db }, { id }) => {
    const [treatment] = await db
      .select({
        id: treatments.id,
        description: treatments.description,
        procedure: treatments.procedure,
        toothNumbers: treatments.toothNumbers,
        cost: treatments.cost,
        status: treatments.status,
        consentStatus: treatments.consentStatus,
        consentDocumentUrl: treatments.consentDocumentUrl,
        consentDocumentName: treatments.consentDocumentName,
        consentNotes: treatments.consentNotes,
        emergencyOverride: treatments.emergencyOverride,
        emergencyReason: treatments.emergencyReason,
        appointmentId: treatments.appointmentId,
        createdAt: treatments.createdAt,
        patientId: treatments.patientId,
        doctorId: treatments.doctorId,
        patientName: patients.name,
        patientCode: patients.patientCode,
        doctorName: users.name,
      })
      .from(treatments)
      .leftJoin(patients, eq(treatments.patientId, patients.id))
      .leftJoin(users, eq(treatments.doctorId, users.id))
      .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

    if (!treatment) return apiError("Not found", 404);
    return apiOk({ treatment });
  }
);

const patchSchema = z.object({
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED"]).optional(),
  description: z.string().min(1).optional(),
  procedure: z.string().optional().nullable(),
  toothNumbers: z.string().optional().nullable(),
  cost: z.number().min(0).optional(),
});

// Valid forward transitions for non-ADMIN roles.
// ADMIN can freely correct status; doctors follow the clinical state machine.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PLANNED: ["IN_PROGRESS", "COMPLETED"],
  IN_PROGRESS: ["COMPLETED", "PLANNED"],
  COMPLETED: [], // only ADMIN can reopen a completed treatment
};

const CLINICAL_ROLES = ["ADMIN", "DOCTOR", "NURSE"];
const TREATMENT_EDIT_ROLES = ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"];

export const PATCH = withRoute<{ id: string }>(
  { route: "PATCH /api/treatments/[id]", rateLimit: RATE_LIMITS.WRITE },
  async (req, { session, db, log }, { id }) => {
    if (!TREATMENT_EDIT_ROLES.includes(session.role)) {
      log.security("Permission denied: role not in TREATMENT_EDIT_ROLES", { role: session.role });
      return apiError("Forbidden", 403);
    }

    const [existing] = await db
      .select({ id: treatments.id, status: treatments.status })
      .from(treatments)
      .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));
    if (!existing) return apiError("Not found", 404);

    const data = patchSchema.parse(await req.json());

    const hasClinicalEdits =
      data.description !== undefined ||
      data.procedure !== undefined ||
      data.toothNumbers !== undefined;
    if (hasClinicalEdits && !CLINICAL_ROLES.includes(session.role)) {
      log.security("Permission denied: clinical edits require clinical role", { role: session.role });
      return apiError("Forbidden: only clinical staff can edit treatment details", 403);
    }

    if (data.status !== undefined && data.status !== existing.status && session.role !== "ADMIN") {
      const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(data.status)) {
        return apiError(`Cannot transition treatment from ${existing.status} to ${data.status}`, 422);
      }
    }

    const updates: Record<string, unknown> = {};
    if (data.status !== undefined) updates.status = data.status;
    if (data.description !== undefined) updates.description = data.description;
    if (data.procedure !== undefined) updates.procedure = data.procedure;
    if (data.toothNumbers !== undefined) updates.toothNumbers = data.toothNumbers;
    if (data.cost !== undefined) updates.cost = data.cost;

    if (Object.keys(updates).length === 0) return apiError("No fields to update", 400);

    await db.update(treatments).set(updates).where(
      and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId))
    );

    log.info("Treatment updated", { treatmentId: id, updatedFields: Object.keys(updates) });
    return apiOk({ success: true });
  }
);

export const DELETE = withRoute<{ id: string }>(
  { route: "DELETE /api/treatments/[id]", rateLimit: RATE_LIMITS.DESTRUCTIVE },
  async (_req, { session, db, log }, { id }) => {
    // Treatment deletion is irreversible clinical record destruction — ADMIN and DOCTOR only
    if (!["ADMIN", "DOCTOR"].includes(session.role)) {
      log.security("Permission denied: only ADMIN/DOCTOR can delete treatments", { role: session.role });
      return apiError("Forbidden", 403);
    }

    const [existing] = await db
      .select({ id: treatments.id })
      .from(treatments)
      .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));
    if (!existing) return apiError("Not found", 404);

    // Block deletion if any visit item has been billed against this treatment.
    const [billedRow] = await db
      .select({ total: sum(visitItems.amount) })
      .from(visitItems)
      .where(eq(visitItems.linkedTreatmentId, id));
    if (Number(billedRow?.total ?? 0) > 0) {
      return apiError("Cannot delete a treatment that has been billed. Remove the linked bill items first.", 422);
    }

    // Audit before destroying — after deletion the record is gone.
    writeAuditLog({
      organizationId: session.orgId,
      actorId: session.userId,
      actorRole: session.role,
      action: "TREATMENT_DELETED",
      targetType: "treatment",
      targetId: id,
    });

    await db.delete(visitTreatments).where(eq(visitTreatments.treatmentId, id));
    await db.delete(invoiceTreatments).where(eq(invoiceTreatments.treatmentId, id));
    await db.delete(consentAuditLog).where(eq(consentAuditLog.treatmentId, id));
    await db.delete(treatments).where(
      and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId))
    );

    log.info("Treatment deleted", { treatmentId: id });
    return apiOk({ success: true });
  }
);
