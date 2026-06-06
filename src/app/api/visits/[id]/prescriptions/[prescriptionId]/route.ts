import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { prescriptions, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { logger } from "@/lib/logger";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prescriptionId: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("DELETE /api/visits/[id]/prescriptions/[prescriptionId]", session);
  if (!await hasPermission(session, PERMISSIONS.VISITS_EDIT)) {
    log.security("Permission denied: VISITS_EDIT", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, prescriptionId } = await params;
  const db = getDb();

  const [visit] = await db
    .select({ organizationId: visits.organizationId })
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));

  if (!visit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(prescriptions).where(
    and(eq(prescriptions.id, prescriptionId), eq(prescriptions.visitId, id))
  );

  log.info("Prescription deleted", { prescriptionId, visitId: id });
  return NextResponse.json({ success: true });
}
