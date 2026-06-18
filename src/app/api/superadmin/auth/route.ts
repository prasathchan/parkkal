import env from "@/lib/env";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { isSuperAdmin } from "@/lib/superadmin";
import { createSuperadminToken, logSuperadminAction } from "@/lib/superadmin-auth";

/**
 * POST /api/superadmin/auth
 *
 * Exchange a valid org session for a short-lived superadmin session token (1 hour).
 * The token must be sent as X-Superadmin-Token on all subsequent superadmin requests.
 *
 * Requires:
 *   - Valid pkd_org_session cookie (regular login)
 *   - users.isSuperAdmin = 1 for the caller
 *   - SUPERADMIN_SECRET env var must be configured
 */
export const POST = withRoute(
  { route: "POST /api/superadmin/auth", rateLimit: RATE_LIMITS.OTP, skipSubscriptionCheck: true },
  async (_req, { session, db, log }) => {
    if (!env.SUPERADMIN_SECRET) {
      log.security("Superadmin auth attempted but SUPERADMIN_SECRET not configured", {});
      return apiError("Superadmin access is not enabled on this instance", 403);
    }

    if (!await isSuperAdmin(db, session.userId)) {
      log.security("Non-superadmin attempted superadmin auth", {});
      return apiError("Forbidden", 403);
    }

    const token = await createSuperadminToken(session.userId);
    await logSuperadminAction(session.userId, "SUPERADMIN_AUTH", { orgId: session.orgId });
    log.info("Superadmin session token issued");
    return apiOk({ token, expiresIn: 3600 });
  }
);
