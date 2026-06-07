import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { attachments, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { deleteFile } from "@/lib/storage";

const DESTRUCTIVE_RATE_LIMIT = { limit: 10, windowMs: 60_000 };

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`destructive:${session.userId}`, DESTRUCTIVE_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const log = logger.forRoute("DELETE /api/visits/[id]/attachments/[attachmentId]", session);
  if (!await hasPermission(session, PERMISSIONS.VISITS_EDIT)) {
    log.security("Permission denied: VISITS_EDIT", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, attachmentId } = await params;
  const db = getDb();

  // Verify the visit belongs to this org
  const [visit] = await db.select({ organizationId: visits.organizationId }).from(visits).where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify attachment belongs to this specific visit (prevents cross-visit deletion within same org)
  const [att] = await db.select().from(attachments).where(and(eq(attachments.id, attachmentId), eq(attachments.visitId, id)));
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete from storage (R2 in production, local in dev)
  const key = att.fileUrl.startsWith("/api/files/")
    ? att.fileUrl.replace("/api/files/", "")
    : `patients/${att.patientId}/${att.fileName}`;
  await deleteFile(key).catch(() => {});

  await db.delete(attachments).where(and(eq(attachments.id, attachmentId), eq(attachments.visitId, id)));
  log.info("Attachment deleted", { attachmentId, visitId: id });
  return NextResponse.json({ success: true });
}
