import { eq, and } from "drizzle-orm";
import { treatments, consentAuditLog } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const overrideSchema = z.object({
  reason: z.string().min(5, "Please provide a reason of at least 5 characters"),
});

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/treatments/[id]/consent" },
  async (_req, { session, db }, { id }) => {
    const [treatment] = await db
      .select({
        id: treatments.id,
        consentStatus: treatments.consentStatus,
        consentDocumentUrl: treatments.consentDocumentUrl,
        consentDocumentName: treatments.consentDocumentName,
        consentUploadedAt: treatments.consentUploadedAt,
        consentVerifiedAt: treatments.consentVerifiedAt,
        consentNotes: treatments.consentNotes,
        emergencyOverride: treatments.emergencyOverride,
        emergencyReason: treatments.emergencyReason,
      })
      .from(treatments)
      .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

    if (!treatment) return apiError("Not found", 404);
    return apiOk({ consent: treatment });
  }
);

export const PATCH = withRoute<{ id: string }>(
  { route: "PATCH /api/treatments/[id]/consent", rateLimit: RATE_LIMITS.WRITE },
  async (req, { session, db, log }, { id }) => {
    if (!["ADMIN", "DOCTOR"].includes(session.role)) {
      log.security("Permission denied: only ADMIN/DOCTOR can apply consent override", { role: session.role });
      return apiError("Forbidden", 403);
    }

    const [treatment] = await db
      .select({ id: treatments.id })
      .from(treatments)
      .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));
    if (!treatment) return apiError("Not found", 404);

    let body: unknown;
    try { body = await req.json(); } catch { return apiError("Invalid JSON", 400); }

    const parsed = overrideSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400);

    const now = Date.now();

    await db
      .update(treatments)
      .set({
        consentStatus: "EMERGENCY_OVERRIDE",
        emergencyOverride: 1,
        emergencyReason: parsed.data.reason,
        consentVerifiedAt: now,
      })
      .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

    await db.insert(consentAuditLog).values({
      id: crypto.randomUUID(),
      treatmentId: id,
      organizationId: session.orgId,
      actorId: session.userId,
      actorRole: session.role,
      action: "EMERGENCY_OVERRIDE",
      reason: parsed.data.reason,
      createdAt: now,
    });

    log.info("Emergency consent override applied", { treatmentId: id, reason: parsed.data.reason });
    return apiOk({ success: true, consentStatus: "EMERGENCY_OVERRIDE" });
  }
);
