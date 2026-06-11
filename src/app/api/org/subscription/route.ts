import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";
import { getOrgSubscription } from "@/lib/subscription";

export const GET = withRoute(
  { route: "GET /api/org/subscription", rateLimit: RATE_LIMITS.READ, skipSubscriptionCheck: true },
  async (_req, { session, db }) => {
    const sub = await getOrgSubscription(db, session.orgId);
    return apiOk({ subscription: sub });
  }
);
