import { eq, and } from "drizzle-orm";
import { attachments, visits } from "@/db/schema";
import { storeFile } from "@/lib/storage";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError } from "@/lib/api";

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

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/visits/[id]/attachments", permission: PERMISSIONS.VISITS_VIEW },
  async (_req, { session, db }, { id }) => {
    const [visit] = await db
      .select({ organizationId: visits.organizationId })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Visit not found", 404);

    const rows = await db.select().from(attachments).where(eq(attachments.visitId, id));
    return apiOk({ attachments: rows });
  }
);

export const POST = withRoute<{ id: string }>(
  { route: "POST /api/visits/[id]/attachments", rateLimit: UPLOAD_RATE_LIMIT, permission: PERMISSIONS.VISITS_EDIT },
  async (req, { session, db, log }, { id }) => {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const fileTypeRaw = (formData.get("fileType") as string) || "OTHER";

    if (!file) return apiError("file is required", 400);

    const fileType: AttachmentFileType = VALID_FILE_TYPES.includes(fileTypeRaw as AttachmentFileType)
      ? (fileTypeRaw as AttachmentFileType)
      : "OTHER";

    const allowedExt = ALLOWED_MIME_TYPES[file.type];
    if (!allowedExt) {
      return apiError("File type not allowed. Allowed: JPEG, PNG, WebP, GIF, PDF", 400);
    }
    if (file.size > MAX_SIZE) return apiError("File must be under 10 MB", 400);

    const [visitRow] = await db
      .select({ organizationId: visits.organizationId, patientId: visits.patientId })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visitRow) return apiError("Visit not found", 404);

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
    return apiOk({ attachment: newAttachment }, 201);
  }
);
