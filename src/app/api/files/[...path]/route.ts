import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";
import { getDb } from "@/lib/db";
import { attachments, visits, organizationPatients } from "@/db/schema";
import { getSession } from "@/lib/auth";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".dcm": "application/dicom",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path: segments } = await params;

  // Expect exactly [patientId, fileName]
  if (!segments || segments.length !== 2) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [patientId, fileName] = segments;

  // Reject path traversal attempts
  if (patientId.includes("..") || patientId.includes("/") || fileName.includes("..") || fileName.includes("/")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();

  // Verify patient belongs to this org
  const [orgLink] = await db
    .select({ patientId: organizationPatients.patientId })
    .from(organizationPatients)
    .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, patientId)));

  if (!orgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify this attachment record exists in the DB
  const [att] = await db
    .select({ id: attachments.id, mimeType: attachments.mimeType, visitId: attachments.visitId })
    .from(attachments)
    .where(and(eq(attachments.patientId, patientId), eq(attachments.fileName, fileName)));

  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify the visit belongs to this org
  const [visit] = await db
    .select({ organizationId: visits.organizationId })
    .from(visits)
    .where(and(eq(visits.id, att.visitId), eq(visits.organizationId, session.orgId)));

  if (!visit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const filePath = path.join(process.cwd(), "private_uploads", patientId, fileName);
    const data = await readFile(filePath);

    const ext = path.extname(fileName).toLowerCase();
    const contentType = MIME_BY_EXT[ext] ?? att.mimeType ?? "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
