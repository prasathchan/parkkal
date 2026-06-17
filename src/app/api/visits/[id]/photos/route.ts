import { eq, and } from "drizzle-orm";
import { clinicalPhotos, visits } from "@/db/schema";
import { storeFile } from "@/lib/storage";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError } from "@/lib/api";

const UPLOAD_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png":  ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

const VALID_ROLES = ["BEFORE", "AFTER", "PROGRESS", "UNTAGGED"] as const;
const VALID_TYPES = ["INTRA_ORAL", "EXTRA_ORAL", "FULL_FACE", "PANORAMIC", "OTHER"] as const;

type PhotoRole = typeof VALID_ROLES[number];
type PhotoType = typeof VALID_TYPES[number];

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/visits/[id]/photos", permission: PERMISSIONS.VISITS_VIEW },
  async (_req, { session, db }, { id }) => {
    const [visit] = await db
      .select({ organizationId: visits.organizationId })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Visit not found", 404);

    const photos = await db
      .select()
      .from(clinicalPhotos)
      .where(eq(clinicalPhotos.visitId, id));

    return apiOk({ photos });
  }
);

export const POST = withRoute<{ id: string }>(
  { route: "POST /api/visits/[id]/photos", rateLimit: UPLOAD_RATE_LIMIT, permission: PERMISSIONS.VISITS_EDIT },
  async (req, { session, db, log }, { id }) => {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return apiError("file is required", 400);

    const photoRoleRaw = (formData.get("photoRole") as string) || "UNTAGGED";
    const photoTypeRaw = (formData.get("photoType") as string) || "INTRA_ORAL";
    const treatmentId   = (formData.get("treatmentId") as string) || null;
    const notes         = (formData.get("notes") as string) || null;

    const photoRole: PhotoRole = VALID_ROLES.includes(photoRoleRaw as PhotoRole)
      ? (photoRoleRaw as PhotoRole) : "UNTAGGED";
    const photoType: PhotoType = VALID_TYPES.includes(photoTypeRaw as PhotoType)
      ? (photoTypeRaw as PhotoType) : "INTRA_ORAL";

    const allowedExt = ALLOWED_MIME_TYPES[file.type];
    if (!allowedExt) return apiError("Only JPEG, PNG, WebP, HEIC images are allowed", 400);
    if (file.size > MAX_SIZE) return apiError("Photo must be under 20 MB", 400);

    const [visitRow] = await db
      .select({ organizationId: visits.organizationId, patientId: visits.patientId })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visitRow) return apiError("Visit not found", 404);

    const fileName = `${crypto.randomUUID()}${allowedExt}`;
    const key = `clinical-photos/${visitRow.patientId}/${fileName}`;
    const bytes = await file.arrayBuffer();
    const { url: fileUrl } = await storeFile(key, bytes, file.type);

    const photo = {
      id:             crypto.randomUUID(),
      organizationId: session.orgId,
      visitId:        id,
      patientId:      visitRow.patientId,
      treatmentId:    treatmentId || null,
      photoRole,
      photoType,
      fileName,
      originalName:   file.name.replace(/[^\w.\-]/g, "_").slice(0, 255),
      mimeType:       file.type,
      fileSize:       file.size,
      fileUrl,
      notes:          notes || null,
      uploadedBy:     session.userId,
      createdAt:      Date.now(),
    };

    await db.insert(clinicalPhotos).values(photo);
    log.info("Clinical photo uploaded", { photoId: photo.id, visitId: id, photoRole, photoType });
    return apiOk({ photo }, 201);
  }
);
