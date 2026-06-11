import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { eq } from "drizzle-orm";
import { organizations } from "@/db/schema";

export const POST = withRoute(
  { route: "POST /api/org/onboarding/dismiss", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.ORG_SETTINGS },
  async (_req, { session, db }) => {
    await db
      .update(organizations)
      .set({ onboardingDismissedAt: Date.now() })
      .where(eq(organizations.id, session.orgId));

    return apiOk({ dismissed: true });
  },
);
