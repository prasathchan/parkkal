/**
 * GET /api/patients/[id]/tooth-condition-history
 *
 * Returns per-tooth condition change history for a patient.
 * Optionally filtered by tooth number or visit.
 *
 * Query params:
 *   toothNumber — filter to a single FDI tooth (e.g. "16")
 *   visitId     — filter to changes recorded during a specific visit
 *   limit       — default 100
 */
import { eq, and, desc } from "drizzle-orm";
import { toothConditionHistory, organizationPatients, visits, users } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";

export const GET = withRoute(
  {
    route: "GET /api/patients/[id]/tooth-condition-history",
    permission: PERMISSIONS.PATIENTS_VIEW,
    rateLimit: RATE_LIMITS.READ,
  },
  async (req, { session, db }, params) => {
    const patientId     = (params as Record<string, string>).id;
    const url           = req.nextUrl;
    const toothNumber   = url.searchParams.get("toothNumber") ?? null;
    const filterVisitId = url.searchParams.get("visitId") ?? null;
    const limit         = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 200);

    const [link] = await db
      .select({ id: organizationPatients.id })
      .from(organizationPatients)
      .where(
        and(
          eq(organizationPatients.organizationId, session.orgId),
          eq(organizationPatients.patientId, patientId),
        )
      )
      .limit(1);
    if (!link) return apiError("Patient not found", 404);

    const conditions = [
      eq(toothConditionHistory.organizationId, session.orgId),
      eq(toothConditionHistory.patientId, patientId),
      ...(toothNumber   ? [eq(toothConditionHistory.toothNumber, toothNumber)]   : []),
      ...(filterVisitId ? [eq(toothConditionHistory.visitId, filterVisitId)]     : []),
    ];

    const rows = await db
      .select({
        id:                toothConditionHistory.id,
        toothNumber:       toothConditionHistory.toothNumber,
        previousCondition: toothConditionHistory.previousCondition,
        newCondition:      toothConditionHistory.newCondition,
        visitId:           toothConditionHistory.visitId,
        visitCode:         visits.visitCode,
        visitDate:         visits.visitDate,
        treatmentId:       toothConditionHistory.treatmentId,
        source:            toothConditionHistory.source,
        recordedBy:        toothConditionHistory.recordedBy,
        recordedByName:    users.name,
        recordedAt:        toothConditionHistory.recordedAt,
      })
      .from(toothConditionHistory)
      .leftJoin(visits, eq(toothConditionHistory.visitId, visits.id))
      .leftJoin(users,  eq(toothConditionHistory.recordedBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(toothConditionHistory.recordedAt))
      .limit(limit);

    return apiOk({ history: rows });
  }
);
