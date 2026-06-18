/**
 * GET  /api/admin/feature-flags — read current flag values
 * PATCH /api/admin/feature-flags — update one or more flags (ADMIN only)
 */
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { getFeatureFlags, setFeatureFlags, DEFAULT_FLAGS } from "@/lib/feature-flags";
import { z } from "zod";

const patchSchema = z.object({
  void_payments: z.boolean().optional(),
  recall_notify: z.boolean().optional(),
  consent_ai: z.boolean().optional(),
});

export const GET = withRoute(
  { route: "GET /api/admin/feature-flags", rateLimit: RATE_LIMITS.READ },
  async (_req, { session }) => {
    if (session.role !== "ADMIN") return apiError("Forbidden", 403);
    const flags = await getFeatureFlags();
    return apiOk({ flags, defaults: DEFAULT_FLAGS });
  }
);

export const PATCH = withRoute(
  { route: "PATCH /api/admin/feature-flags", rateLimit: RATE_LIMITS.WRITE },
  async (req, { session, log }) => {
    if (session.role !== "ADMIN") return apiError("Forbidden", 403);

    let body: unknown;
    try { body = await req.json(); } catch { return apiError("Invalid JSON", 400); }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400);
    if (Object.keys(parsed.data).length === 0) return apiError("No flags provided", 400);

    await setFeatureFlags(parsed.data);
    const updated = await getFeatureFlags();

    log.info("Feature flags updated", { changes: parsed.data, orgId: session.orgId });
    return apiOk({ flags: updated });
  }
);
