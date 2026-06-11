import { z } from "zod";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { restoreSnapshot } from "@/lib/backup-engine";

const restoreSchema = z.object({
  snapshotId:   z.string().uuid(),
  confirmation: z.literal("RESTORE"),
});

/** POST /api/backup/restore — restore org data from a snapshot */
export const POST = withRoute(
  { route: "POST /api/backup/restore", rateLimit: RATE_LIMITS.DESTRUCTIVE, permission: PERMISSIONS.ORG_SETTINGS },
  async (req, { session, db }) => {
    const body = restoreSchema.parse(await req.json());
    await restoreSnapshot(db, body.snapshotId, session.orgId, session.userId);
    return apiOk({ restored: true });
  },
);
