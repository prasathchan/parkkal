import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { attachments, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { storeFile } from "@/lib/storage";

const UPLOAD_RATE_LIMIT = { limit: 20, windowMs: 60_000 };

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "image/dicom": ".dcm",
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const VALID_FILE_TYPES = ["XRAY", "PRESCRIPTION", "DOCTOR_NOTE", "LAB_REPORT", "OTHER"] as const;
type AttachmentFileType = typeof VALID_FILE_TYPES[number];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("GET /api/visits/[id]/attachments", session);
  if (!await hasPermission(session, PERMISSIONS.VISITS_VIEW)) {
    log.security("Permission denied: VISITS_VIEW", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();
  const [visit] = await db
    .select({ organizationId: visits.organizationId })
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const rows = await db.select().from(attachments).where(eq(attachments.visitId, id));
  return NextResponse.json({ attachments: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`upload:${session.userId}`, UPLOAD_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const log = logger.forRoute("POST /api/visits/[id]/attachments", session);
  if (!await hasPermission(session, PERMISSIONS.VISITS_EDIT)) {
    log.security("Permission denied: VISITS_EDIT", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const fileTypeRaw = (formData.get("fileType") as string) || "OTHER";

  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  const fileType: AttachmentFileType = VALID_FILE_TYPES.includes(fileTypeRaw as AttachmentFileType)
    ? (fileTypeRaw as AttachmentFileType)
    : "OTHER";

  const allowedExt = ALLOWED_MIME_TYPES[file.type];
  if (!allowedExt) {
    return NextResponse.json(
      { error: "File type not allowed. Allowed: JPEG, PNG, WebP, GIF, PDF" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File must be under 10 MB" }, { status: 400 });
  }

  const db = getDb();
  const [visitRow] = await db
    .select({ organizationId: visits.organizationId, patientId: visits.patientId })
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
  if (!visitRow) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const fileName = `${crypto.randomUUID()}${allowedExt}`;
  const key = `patients/${visitRow.patientId}/${fileName}`;
  const bytes = await file.arrayBuffer();
  const { url: fileUrl } = await storeFile(key, bytes, file.type);

  const newAttachment = {
    id: crypto.randomUUID(),
    visitId: id,
    patientId: visitRow.patientId,
    fileName,
    originalName: file.name.replace(/[^\w.\-]/g, "_").slice(0, 255),
    fileType,
    mimeType: file.type,
    fileSize: file.size,
    fileUrl,
    uploadedBy: session.userId,
    createdAt: Date.now(),
  };

  await db.insert(attachments).values(newAttachment);
  log.info("Attachment uploaded", { attachmentId: newAttachment.id, visitId: id, fileType, mimeType: file.type });
  return NextResponse.json({ attachment: newAttachment }, { status: 201 });
}
