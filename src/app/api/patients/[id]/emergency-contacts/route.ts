import { eq, and } from "drizzle-orm";
import { emergencyContacts, organizationPatients } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";

/** GET /api/patients/[id]/emergency-contacts — list emergency contacts for a patient */
export const GET = withRoute<{ id: string }>(
  { route: "GET /api/patients/[id]/emergency-contacts", rateLimit: RATE_LIMITS.READ },
  async (_req, { session, db }, { id: patientId }) => {
    // Verify patient belongs to this org
    const [membership] = await db
      .select({ patientId: organizationPatients.patientId })
      .from(organizationPatients)
      .where(and(
        eq(organizationPatients.organizationId, session.orgId),
        eq(organizationPatients.patientId, patientId)
      ));
    if (!membership) return apiError("Forbidden", 403);

    const contacts = await db.select().from(emergencyContacts)
      .where(and(eq(emergencyContacts.entityType, "PATIENT"), eq(emergencyContacts.entityId, patientId)));

    return apiOk({ contacts });
  }
);
