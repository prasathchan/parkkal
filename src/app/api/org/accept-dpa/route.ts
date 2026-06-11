import { eq } from "drizzle-orm";
import { organizations } from "@/db/schema";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";

const CURRENT_DPA_VERSION = "v1";

/** POST /api/org/accept-dpa — record that the org admin has accepted the DPA (ADMIN only) */
export const POST = withRoute(
  { route: "POST /api/org/accept-dpa", rateLimit: RATE_LIMITS.WRITE, adminOnly: true },
  async (_req, { session, db }) => {
    await db
      .update(organizations)
      .set({
        dpaVersion: CURRENT_DPA_VERSION,
        dpaAcceptedAt: Date.now(),
        dpaAcceptedBy: session.userId,
        updatedAt: Date.now(),
      })
      .where(eq(organizations.id, session.orgId));

    writeAuditLog({
      organizationId: session.orgId,
      actorId: session.userId,
      actorRole: session.role,
      action: "ORG_PROFILE_UPDATED",
      targetType: "organization",
      targetId: session.orgId,
      metadata: { dpaVersion: CURRENT_DPA_VERSION, event: "dpa-accepted" },
    });

    return apiOk({ accepted: true, version: CURRENT_DPA_VERSION });
  }
);
