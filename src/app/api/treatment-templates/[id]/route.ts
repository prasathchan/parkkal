import { eq, and } from "drizzle-orm";
import { treatmentTemplates } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";

type Params = { id: string };

// ── DELETE /api/treatment-templates/[id] ─────────────────────────────────────
export const DELETE = withRoute<Params>(
  { route: "DELETE /api/treatment-templates/[id]", rateLimit: RATE_LIMITS.DESTRUCTIVE, permission: PERMISSIONS.TREATMENTS_DELETE },
  async (_req, { session, db, log }, { id }) => {
    if (!["ADMIN", "DOCTOR"].includes(session.role)) {
      log.security("Permission denied: only ADMIN/DOCTOR can delete templates", { role: session.role });
      return apiError("Forbidden", 403);
    }

    const [existing] = await db
      .select({ id: treatmentTemplates.id })
      .from(treatmentTemplates)
      .where(and(eq(treatmentTemplates.id, id), eq(treatmentTemplates.organizationId, session.orgId)));
    if (!existing) return apiError("Template not found", 404);

    await db.delete(treatmentTemplates).where(eq(treatmentTemplates.id, id));
    log.info("Treatment template deleted", { id });
    return apiOk({ success: true });
  }
);
