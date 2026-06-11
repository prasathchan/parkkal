import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";
import { subscriptionPlans } from "@/db/schema";
import { eq } from "drizzle-orm";

export const GET = withRoute(
  { route: "GET /api/plans", rateLimit: RATE_LIMITS.READ, skipSubscriptionCheck: true },
  async (_req, { db }) => {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, 1))
      .orderBy(subscriptionPlans.sortOrder);
    return apiOk({ plans });
  }
);
