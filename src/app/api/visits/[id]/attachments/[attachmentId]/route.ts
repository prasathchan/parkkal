import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { attachments, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { deleteFile } from "@/lib/storage";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, attachmentId } = await params;
  const db = getDb();

  const [att] = await db.select().from(attachments).where(eq(attachments.id, attachmentId));
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [visit] = await db.select({ organizationId: visits.organizationId }).from(visits).where(eq(visits.id, id));
  if (!visit || visit.organizationId !== session.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Delete from storage (R2 in production, local in dev)
  const key = att.fileUrl.startsWith("/api/files/")
    ? att.fileUrl.replace("/api/files/", "")
    : `patients/${att.patientId}/${att.fileName}`;
  await deleteFile(key).catch(() => {});

  await db.delete(attachments).where(eq(attachments.id, attachmentId));
  return NextResponse.json({ success: true });
}
