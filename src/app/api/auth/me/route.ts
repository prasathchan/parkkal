import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";

/** GET /api/auth/me — return the current session payload */
export const GET = withRoute(
  { route: "GET /api/auth/me", rateLimit: RATE_LIMITS.READ },
  async (_req, { session, log }) => {
    log.info("Session fetched", { userId: session.userId });
    return apiOk({ user: session });
  }
);
