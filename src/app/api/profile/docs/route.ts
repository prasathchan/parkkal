import { eq } from "drizzle-orm";
import { staffProfiles } from "@/db/schema";
import { storeFile } from "@/lib/storage";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import type { CredentialDoc, CredentialDocType } from "@/types";

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const MAX_SIZE = 10 * 1024 * 1024;

const VALID_DOC_TYPES: CredentialDocType[] = [
  "DEGREE_CERTIFICATE", "REGISTRATION_CERTIFICATE", "IDA_CARD",
  "DCI_CARD", "GOVERNMENT_ID", "TRAINING_CERT", "OTHER",
];

/** POST /api/profile/docs — staff uploads their own credential document (goes to PENDING review) */
export const POST = withRoute(
  { route: "POST /api/profile/docs", rateLimit: RATE_LIMITS.WRITE },
  async (req, { session, db, log }) => {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const docTypeRaw = (formData.get("docType") as string) || "OTHER";

    if (!file) return apiError("file is required", 400);

    const docType: CredentialDocType = VALID_DOC_TYPES.includes(docTypeRaw as CredentialDocType)
      ? (docTypeRaw as CredentialDocType)
      : "OTHER";

    const allowedExt = ALLOWED_MIME_TYPES[file.type];
    if (!allowedExt) return apiError("Only JPEG, PNG, WebP and PDF files are allowed", 400);
    if (file.size > MAX_SIZE) return apiError("File must be under 10 MB", 400);

    const fileName = `${crypto.randomUUID()}${allowedExt}`;
    const key = `staff-docs/${session.userId}/${fileName}`;
    const bytes = await file.arrayBuffer();
    const { url: fileUrl } = await storeFile(key, bytes, file.type);

    const newDoc: CredentialDoc = {
      id: crypto.randomUUID(),
      docType,
      originalName: file.name.replace(/[^\w.\-]/g, "_").slice(0, 255),
      fileName,
      fileUrl,
      uploadedAt: Date.now(),
      status: "PENDING",  // always needs admin review when staff self-uploads
    };

    const [profile] = await db.select({ documents: staffProfiles.documents })
      .from(staffProfiles).where(eq(staffProfiles.userId, session.userId));
    const now = Date.now();

    if (profile) {
      const docs: CredentialDoc[] = JSON.parse(profile.documents ?? "[]");
      docs.push(newDoc);
      await db.update(staffProfiles)
        .set({ documents: JSON.stringify(docs), updatedAt: now })
        .where(eq(staffProfiles.userId, session.userId));
    } else {
      await db.insert(staffProfiles).values({
        userId: session.userId,
        bio: null, specialization: null, yearsExperience: null,
        languages: "[]", qualifications: "[]",
        idaNumber: null, dciNumber: null, stateCouncilNumber: null,
        licenseExpiry: null, previousEmployer: null,
        documents: JSON.stringify([newDoc]),
        createdAt: now, updatedAt: now,
      });
    }

    log.info("Staff self-uploaded credential doc (PENDING review)", { docType, docId: newDoc.id });
    return apiOk({ document: newDoc }, 201);
  }
);
