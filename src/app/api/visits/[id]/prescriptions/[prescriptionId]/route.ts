import { eq, and } from "drizzle-orm";
import { prescriptions, visits } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";

export const DELETE = withRoute<{ id: string; prescriptionId: string }>(
  { route: "DELETE /api/visits/[id]/prescriptions/[prescriptionId]", rateLimit: RATE_LIMITS.DESTRUCTIVE, permission: PERMISSIONS.VISITS_EDIT },
  async (_req, { session, db, log }, { id, prescriptionId }) => {
    const [visit] = await db
      .select({ organizationId: visits.organizationId })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Forbidden", 403);

    await db.delete(prescriptions).where(
      and(eq(prescriptions.id, prescriptionId), eq(prescriptions.visitId, id))
    );

    log.info("Prescription deleted", { prescriptionId, visitId: id });
    return apiOk({ success: true });
  }
);
