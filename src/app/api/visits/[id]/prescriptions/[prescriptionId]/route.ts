import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { prescriptions, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prescriptionId: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  return NextResponse.json({ success: true });
}
