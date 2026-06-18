import { eq, and } from "drizzle-orm";
import { staffLocationAssignments } from "@/db/schema";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";

/** GET /api/auth/me — return session + the caller's primary branch (if assigned) */
export const GET = withRoute(
  { route: "GET /api/auth/me", rateLimit: RATE_LIMITS.READ },
  async (_req, { session, db, log }) => {
    log.info("Session fetched", { userId: session.userId });

    const [primary] = await db
      .select({ locationId: staffLocationAssignments.locationId })
      .from(staffLocationAssignments)
      .where(
        and(
          eq(staffLocationAssignments.userId, session.userId),
          eq(staffLocationAssignments.organizationId, session.orgId),
          eq(staffLocationAssignments.isPrimary, 1),
        )
      )
      .limit(1);

    return apiOk({ user: { ...session, primaryLocationId: primary?.locationId ?? null } });
  }
);
