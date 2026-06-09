import { eq, and } from "drizzle-orm";
import { attachments, visits } from "@/db/schema";
import { deleteFile } from "@/lib/storage";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";

export const DELETE = withRoute<{ id: string; attachmentId: string }>(
  { route: "DELETE /api/visits/[id]/attachments/[attachmentId]", rateLimit: RATE_LIMITS.DESTRUCTIVE, permission: PERMISSIONS.VISITS_EDIT },
  async (_req, { session, db, log }, { id, attachmentId }) => {
    // Verify the visit belongs to this org
    const [visit] = await db.select({ organizationId: visits.organizationId }).from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Forbidden", 403);

    // Verify attachment belongs to this specific visit (prevents cross-visit deletion within same org)
    const [att] = await db.select().from(attachments)
      .where(and(eq(attachments.id, attachmentId), eq(attachments.visitId, id)));
    if (!att) return apiError("Not found", 404);

    // Delete from storage (R2 in production, local in dev)
    const key = att.fileUrl.startsWith("/api/files/")
      ? att.fileUrl.replace("/api/files/", "")
      : `patients/${att.patientId}/${att.fileName}`;
    await deleteFile(key).catch(() => {});

    await db.delete(attachments).where(and(eq(attachments.id, attachmentId), eq(attachments.visitId, id)));
    log.info("Attachment deleted", { attachmentId, visitId: id });
    return apiOk({ success: true });
  }
);
