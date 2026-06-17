import { eq, and } from "drizzle-orm";
import { clinicalPhotos, treatments } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError } from "@/lib/api";

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/treatments/[id]/photos", permission: PERMISSIONS.TREATMENTS_VIEW },
  async (_req, { session, db }, { id }) => {
    const [treatment] = await db
      .select({ organizationId: treatments.organizationId })
      .from(treatments)
      .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));
    if (!treatment) return apiError("Treatment not found", 404);

    const photos = await db
      .select()
      .from(clinicalPhotos)
      .where(and(
        eq(clinicalPhotos.treatmentId, id),
        eq(clinicalPhotos.organizationId, session.orgId),
      ));

    return apiOk({ photos });
  }
);
