import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";

export const GET = withRoute(
  { route: "GET /api/cron/health", rateLimit: RATE_LIMITS.READ },
  async (_req, { db }) => {
    // Verify DB is reachable
    await db.run("SELECT 1");
    return apiOk({ status: "ok", ts: Date.now() });
  }
);
