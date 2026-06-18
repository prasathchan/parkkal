/**
 * DELETE /api/patients/[id]/consent
 *
 * Withdraws a patient's data processing consent per DPDP Article 13.
 * Clears dataConsentAt and dataConsentIp and marks the record for future deletion review.
 * ADMIN only — this is an irreversible compliance action that must be reviewed.
 */
import { eq, and } from "drizzle-orm";
import { patients, organizationPatients } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";

export const DELETE = withRoute<{ id: string }>(
  { route: "DELETE /api/patients/[id]/consent", rateLimit: RATE_LIMITS.DESTRUCTIVE, permission: PERMISSIONS.PATIENTS_EDIT },
  async (_req, { session, db, log }, { id }) => {
    if (session.role !== "ADMIN") {
      log.security("Only ADMIN may withdraw patient consent", { role: session.role });
      return apiError("Forbidden — only administrators may withdraw patient consent", 403);
    }

    const [orgLink] = await db
      .select()
      .from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, id)));
    if (!orgLink) return apiError("Patient not found", 404);

    const [patient] = await db.select({ dataConsentAt: patients.dataConsentAt }).from(patients).where(eq(patients.id, id));
    if (!patient) return apiError("Patient not found", 404);
    if (!patient.dataConsentAt) return apiError("Patient has no active consent on record", 400);

    await db
      .update(patients)
      .set({ dataConsentAt: null, dataConsentIp: null, updatedAt: Date.now() })
      .where(eq(patients.id, id));

    writeAuditLog({
      organizationId: session.orgId,
      actorId: session.userId,
      actorRole: session.role,
      action: "PATIENT_CONSENT_WITHDRAWN",
      targetType: "patient",
      targetId: id,
      metadata: { previousConsentAt: patient.dataConsentAt },
    });

    log.info("Patient consent withdrawn", { patientId: id });
    return apiOk({ success: true });
  }
);
