import { eq } from "drizzle-orm";
import { organizations } from "@/db/schema";
import { withRoute, RATE_LIMITS, apiOk } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";

const CURRENT_BAA_VERSION = "v1";

export const POST = withRoute(
  { route: "POST /api/org/accept-baa", rateLimit: RATE_LIMITS.WRITE, adminOnly: true },
  async (_req, { session, db }) => {
    await db
      .update(organizations)
      .set({
        baaVersion: CURRENT_BAA_VERSION,
        baaAcceptedAt: Date.now(),
        baaAcceptedBy: session.userId,
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
      metadata: { baaVersion: CURRENT_BAA_VERSION, event: "baa-accepted" },
    });

    return apiOk({ accepted: true, version: CURRENT_BAA_VERSION });
  },
);
