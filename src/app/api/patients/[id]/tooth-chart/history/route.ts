import { eq, and, desc } from "drizzle-orm";
import { toothChartHistory, organizationPatients, visits, users } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";

/** GET /api/patients/[id]/tooth-chart/history */
export const GET = withRoute(
  { route: "GET /api/patients/[id]/tooth-chart/history", permission: PERMISSIONS.PATIENTS_VIEW, rateLimit: RATE_LIMITS.READ },
  async (_req, { session, db }, params) => {
    const patientId = (params as Record<string, string>).id;

    const [link] = await db.select({ id: organizationPatients.id })
      .from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, patientId)))
      .limit(1);
    if (!link) return apiError("Patient not found", 404);

    const rows = await db
      .select({
        id:           toothChartHistory.id,
        visitId:      toothChartHistory.visitId,
        visitCode:    visits.visitCode,
        toothData:    toothChartHistory.toothData,
        changedTeeth: toothChartHistory.changedTeeth,
        recordedBy:   toothChartHistory.recordedBy,
        recordedByName: users.name,
        recordedAt:   toothChartHistory.recordedAt,
      })
      .from(toothChartHistory)
      .leftJoin(visits, eq(toothChartHistory.visitId, visits.id))
      .leftJoin(users, eq(toothChartHistory.recordedBy, users.id))
      .where(and(
        eq(toothChartHistory.organizationId, session.orgId),
        eq(toothChartHistory.patientId, patientId),
      ))
      .orderBy(desc(toothChartHistory.recordedAt))
      .limit(50);

    const history = rows.map((r: typeof rows[number]) => ({
      id:             r.id,
      visitId:        r.visitId ?? null,
      visitCode:      r.visitCode ?? null,
      toothData:      JSON.parse(r.toothData) as Record<string, unknown>,
      changedTeeth:   JSON.parse(r.changedTeeth) as string[],
      recordedBy:     r.recordedBy,
      recordedByName: r.recordedByName ?? "Unknown",
      recordedAt:     r.recordedAt,
    }));

    return apiOk({ history });
  }
);
