import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { attachments, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { unlink } from "fs/promises";
import path from "path";

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

  // Try to delete file from private_uploads
  try {
    // fileUrl is either /api/files/<patientId>/<fileName> (new) or /uploads/<patientId>/<fileName> (legacy)
    let filePath: string;
    if (att.fileUrl.startsWith("/api/files/")) {
      const parts = att.fileUrl.replace("/api/files/", "").split("/");
      filePath = path.join(process.cwd(), "private_uploads", ...parts);
    } else {
      filePath = path.join(process.cwd(), "public", att.fileUrl);
    }
    await unlink(filePath);
  } catch {
    // ignore if file missing
  }

  await db.delete(attachments).where(eq(attachments.id, attachmentId));
  return NextResponse.json({ success: true });
}
