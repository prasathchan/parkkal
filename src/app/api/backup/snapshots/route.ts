import { eq, and, desc } from "drizzle-orm";
import { orgBackups } from "@/db/schema";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";

/** GET /api/backup/snapshots — list all snapshots for this org */
export const GET = withRoute(
  { route: "GET /api/backup/snapshots", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.ORG_SETTINGS },
  async (_req, { session, db }) => {
    const snapshots = await db
      .select({
        id:         orgBackups.id,
        type:       orgBackups.type,
        status:     orgBackups.status,
        sizeBytes:  orgBackups.sizeBytes,
        rowCounts:  orgBackups.rowCounts,
        createdBy:  orgBackups.createdBy,
        createdAt:  orgBackups.createdAt,
        errorMessage: orgBackups.errorMessage,
      })
      .from(orgBackups)
      .where(and(
        eq(orgBackups.organizationId, session.orgId),
      ))
      .orderBy(desc(orgBackups.createdAt))
      .limit(50);

    return apiOk({ snapshots });
  },
);
