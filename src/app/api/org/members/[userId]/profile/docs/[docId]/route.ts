import { eq, and } from "drizzle-orm";
import { staffProfiles, organizationMembers } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";
import type { CredentialDoc } from "@/types";

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNote: z.string().max(500).optional(),
});

/** PATCH /api/org/members/[userId]/profile/docs/[docId] — admin approve/reject a credential doc */
export const PATCH = withRoute<{ userId: string; docId: string }>(
  { route: "PATCH /api/org/members/[userId]/profile/docs/[docId]", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.STAFF_MANAGE },
  async (req, { session, db, log }, { userId, docId }) => {
    const parsed = reviewSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Invalid input", 400);

    const [membership] = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId)));
    if (!membership) return apiError("Member not found", 404);

    const [profile] = await db.select({ documents: staffProfiles.documents })
      .from(staffProfiles)
      .where(eq(staffProfiles.userId, userId));
    if (!profile) return apiError("No profile found", 404);

    const docs: CredentialDoc[] = JSON.parse(profile.documents ?? "[]");
    const docIndex = docs.findIndex((d) => d.id === docId);
    if (docIndex === -1) return apiError("Document not found", 404);

    const { action, reviewNote } = parsed.data;
    docs[docIndex] = {
      ...docs[docIndex],
      status: action === "approve" ? "VERIFIED" : "REJECTED",
      reviewNote: reviewNote ?? null,
      reviewedBy: session.userId,
      reviewedAt: Date.now(),
    };

    await db.update(staffProfiles)
      .set({ documents: JSON.stringify(docs), updatedAt: Date.now() })
      .where(eq(staffProfiles.userId, userId));

    log.info(`Staff credential doc ${action}d`, { targetUserId: userId, docId, action });
    return apiOk({ document: docs[docIndex] });
  }
);
