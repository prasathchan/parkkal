import { eq, and } from "drizzle-orm";
import { staffProfiles, organizationMembers } from "@/db/schema";
import { storeFile, deleteFile } from "@/lib/storage";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import type { CredentialDoc, CredentialDocType } from "@/types";

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const VALID_DOC_TYPES: CredentialDocType[] = [
  "DEGREE_CERTIFICATE",
  "REGISTRATION_CERTIFICATE",
  "IDA_CARD",
  "DCI_CARD",
  "GOVERNMENT_ID",
  "TRAINING_CERT",
  "OTHER",
];

async function getOrInitProfile(db: Parameters<Parameters<typeof withRoute>[1]>[1]["db"], userId: string) {
  const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, userId));
  return profile ?? null;
}

/** POST /api/org/members/[userId]/profile/docs — upload a credential document */
export const POST = withRoute<{ userId: string }>(
  { route: "POST /api/org/members/[userId]/profile/docs", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.STAFF_MANAGE },
  async (req, { session, db, log }, { userId }) => {
    const [membership] = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId)));
    if (!membership) return apiError("Member not found", 404);

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
    const key = `staff-docs/${userId}/${fileName}`;
    const bytes = await file.arrayBuffer();
    const { url: fileUrl } = await storeFile(key, bytes, file.type);

    const newDoc: CredentialDoc = {
      id: crypto.randomUUID(),
      docType,
      originalName: file.name.replace(/[^\w.\-]/g, "_").slice(0, 255),
      fileName,
      fileUrl,
      uploadedAt: Date.now(),
      // Admin uploads are pre-verified; staff self-uploads go PENDING
      status: "VERIFIED",
      reviewedBy: session.userId,
      reviewedAt: Date.now(),
    };

    const profile = await getOrInitProfile(db, userId);
    const now = Date.now();

    if (profile) {
      const docs: CredentialDoc[] = JSON.parse(profile.documents ?? "[]");
      docs.push(newDoc);
      await db.update(staffProfiles)
        .set({ documents: JSON.stringify(docs), updatedAt: now })
        .where(eq(staffProfiles.userId, userId));
    } else {
      await db.insert(staffProfiles).values({
        userId,
        bio: null, specialization: null, yearsExperience: null,
        languages: "[]", qualifications: "[]",
        idaNumber: null, dciNumber: null, stateCouncilNumber: null,
        licenseExpiry: null, previousEmployer: null,
        documents: JSON.stringify([newDoc]),
        createdAt: now, updatedAt: now,
      });
    }

    log.info("Staff credential doc uploaded", { targetUserId: userId, docType, docId: newDoc.id });
    return apiOk({ document: newDoc }, 201);
  }
);

/** DELETE /api/org/members/[userId]/profile/docs?docId=xxx — remove a credential document */
export const DELETE = withRoute<{ userId: string }>(
  { route: "DELETE /api/org/members/[userId]/profile/docs", rateLimit: RATE_LIMITS.DESTRUCTIVE, permission: PERMISSIONS.STAFF_MANAGE },
  async (req, { session, db, log }, { userId }) => {
    const [membership] = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId)));
    if (!membership) return apiError("Member not found", 404);

    const docId = new URL(req.url).searchParams.get("docId");
    if (!docId) return apiError("docId is required", 400);

    const profile = await getOrInitProfile(db, userId);
    if (!profile) return apiError("No profile found", 404);

    const docs: CredentialDoc[] = JSON.parse(profile.documents ?? "[]");
    const target = docs.find((d) => d.id === docId);
    if (!target) return apiError("Document not found", 404);

    try {
      await deleteFile(`staff-docs/${userId}/${target.fileName}`);
    } catch {
      // Non-fatal — remove the DB record even if R2 delete fails
    }

    const remaining = docs.filter((d) => d.id !== docId);
    await db.update(staffProfiles)
      .set({ documents: JSON.stringify(remaining), updatedAt: Date.now() })
      .where(eq(staffProfiles.userId, userId));

    log.info("Staff credential doc deleted", { targetUserId: userId, docId });
    return apiOk({ success: true });
  }
);
