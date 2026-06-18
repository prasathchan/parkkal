import { eq, and } from "drizzle-orm";
import { treatments, consentAuditLog, organizationMembers, users, organizations } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { writeSensitiveAuditLog } from "@/lib/audit";
import { sendEmergencyOverrideNotification } from "@/lib/email";
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
      .select({ id: treatments.id, description: treatments.description })
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

    // HIGH-severity audit log entry (awaited so it commits before response)
    await writeSensitiveAuditLog({
      organizationId: session.orgId,
      actorId: session.userId,
      actorRole: session.role,
      action: "CONSENT_EMERGENCY_OVERRIDE",
      targetType: "treatment",
      targetId: id,
      metadata: { reason: parsed.data.reason, treatmentDescription: treatment.description },
      severity: "HIGH",
    });

    // Notify all ADMIN users — fire-and-forget (email failure must not block the response)
    (async () => {
      try {
        const [actorUser, org, adminMembers] = await Promise.all([
          db.select({ name: users.name }).from(users).where(eq(users.id, session.userId)).limit(1),
          db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, session.orgId)).limit(1),
          db
            .select({ email: users.email })
            .from(organizationMembers)
            .innerJoin(users, eq(organizationMembers.userId, users.id))
            .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.role, "ADMIN"), eq(organizationMembers.isActive, 1))),
        ]);

        const adminEmails = adminMembers.map((m: { email: string }) => m.email).filter(Boolean) as string[];
        if (adminEmails.length === 0) return;

        await sendEmergencyOverrideNotification({
          to: adminEmails,
          orgName: org[0]?.name ?? "Your clinic",
          doctorName: actorUser[0]?.name ?? session.userId,
          treatmentDescription: treatment.description,
          treatmentId: id,
          reason: parsed.data.reason,
        });
      } catch (e) {
        console.error("[consent/override] Failed to send admin notification:", e);
      }
    })();

    log.info("Emergency consent override applied", { treatmentId: id, reason: parsed.data.reason });
    return apiOk({ success: true, consentStatus: "EMERGENCY_OVERRIDE" });
  }
);
