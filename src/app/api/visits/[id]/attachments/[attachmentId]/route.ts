import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { attachments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attachmentId } = await params;
  const db = getDb();

  const [att] = await db.select().from(attachments).where(eq(attachments.id, attachmentId));
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Try to delete file
  try {
    const filePath = path.join(process.cwd(), "public", att.fileUrl);
    await unlink(filePath);
  } catch {
    // ignore if file missing
  }

  await db.delete(attachments).where(eq(attachments.id, attachmentId));
  return NextResponse.json({ success: true });
}
