import { eq, and } from "drizzle-orm";
import { clinicalPhotos, visits } from "@/db/schema";
import { deleteFile } from "@/lib/storage";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError } from "@/lib/api";

export const DELETE = withRoute<{ id: string; photoId: string }>(
  { route: "DELETE /api/visits/[id]/photos/[photoId]", rateLimit: { limit: 20, windowMs: 60_000 }, permission: PERMISSIONS.VISITS_EDIT },
  async (_req, { session, db, log }, { id, photoId }) => {
    const [visitRow] = await db
      .select({ organizationId: visits.organizationId })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visitRow) return apiError("Visit not found", 404);

    const [photo] = await db
      .select()
      .from(clinicalPhotos)
      .where(and(eq(clinicalPhotos.id, photoId), eq(clinicalPhotos.visitId, id)));
    if (!photo) return apiError("Photo not found", 404);

    const key = `clinical-photos/${photo.patientId}/${photo.fileName}`;
    await deleteFile(key).catch(() => {});
    await db.delete(clinicalPhotos).where(eq(clinicalPhotos.id, photoId));

    log.info("Clinical photo deleted", { photoId, visitId: id });
    return apiOk({ success: true });
  }
);
