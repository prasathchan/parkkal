import { and, eq } from "drizzle-orm";
import { orgDrugs } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";

/** DELETE /api/org/drugs/[id] — remove a drug from the clinic formulary (ORG_SETTINGS) */
export const DELETE = withRoute<{ id: string }>(
  { route: "DELETE /api/org/drugs/[id]", permission: PERMISSIONS.ORG_SETTINGS, rateLimit: RATE_LIMITS.DESTRUCTIVE },
  async (_req, { session, db }, { id }) => {
    const [drug] = await db
      .select({ id: orgDrugs.id })
      .from(orgDrugs)
      .where(and(eq(orgDrugs.id, id), eq(orgDrugs.organizationId, session.orgId)));

    if (!drug) return apiError("Drug not found", 404);

    await db
      .delete(orgDrugs)
      .where(and(eq(orgDrugs.id, id), eq(orgDrugs.organizationId, session.orgId)));

    return apiOk({ success: true });
  }
);
