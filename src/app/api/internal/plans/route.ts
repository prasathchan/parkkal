/**
 * GET /api/internal/plans — all plans (including inactive). Console S2S only.
 */

import { subscriptionPlans } from "@/db/schema";
import { withInternalRoute, internalOk } from "@/lib/internal-api";

export const GET = withInternalRoute("GET /api/internal/plans", async (_req, { db }) => {
  const plans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
  return internalOk({ plans });
});
