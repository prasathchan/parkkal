import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { createSnapshot } from "@/lib/backup-engine";

/** POST /api/backup/snapshot — take a manual snapshot of this org's data */
export const POST = withRoute(
  { route: "POST /api/backup/snapshot", rateLimit: RATE_LIMITS.DESTRUCTIVE, permission: PERMISSIONS.ORG_SETTINGS },
  async (_req, { session, db }) => {
    const id = await createSnapshot(db, session.orgId, "manual", session.userId);
    return apiOk({ id });
  },
);
