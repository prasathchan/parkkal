import { eq, and, sum, count, max } from "drizzle-orm";
import { visits, organizationPatients } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";

/** GET /api/patients/[id]/balance — financial summary for a patient */
export const GET = withRoute<{ id: string }>(
  { route: "GET /api/patients/[id]/balance", rateLimit: RATE_LIMITS.READ },
  async (_req, { session, db, log }, { id }) => {
    // Verify patient belongs to this org before exposing any financial data
    const [orgLink] = await db
      .select({ patientId: organizationPatients.patientId })
      .from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, id)));
    if (!orgLink) {
      log.security("Forbidden: patient not in org", { patientId: id });
      return apiError("Forbidden", 403);
    }

    const orgId = session.orgId;

    const [[agg], [dueAgg], [{ pendingVisits }]] = await Promise.all([
      db.select({
        totalBilled: sum(visits.totalAmount),
        totalPaid: sum(visits.paidAmount),
        visitCount: count(),
        lastVisit: max(visits.visitDate),
      }).from(visits).where(and(eq(visits.patientId, id), eq(visits.organizationId, orgId))),

      db.select({
        totalBilled: sum(visits.totalAmount),
        totalPaid: sum(visits.paidAmount),
      }).from(visits).where(and(eq(visits.patientId, id), eq(visits.organizationId, orgId), eq(visits.status, "OPEN"))),

      db.select({ pendingVisits: count() }).from(visits)
        .where(and(eq(visits.patientId, id), eq(visits.organizationId, orgId), eq(visits.status, "OPEN"))),
    ]);

    return apiOk({
      totalBilled: Number(agg?.totalBilled) || 0,
      totalPaid: Number(agg?.totalPaid) || 0,
      totalDue: (Number(dueAgg?.totalBilled) || 0) - (Number(dueAgg?.totalPaid) || 0),
      visitCount: Number(agg?.visitCount) || 0,
      pendingVisits: Number(pendingVisits) || 0,
      lastVisit: agg?.lastVisit || null,
    });
  }
);
