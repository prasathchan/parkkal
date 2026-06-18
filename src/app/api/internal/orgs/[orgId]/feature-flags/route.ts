/**
 * GET  /api/internal/orgs/[orgId]/feature-flags — read flags for one org
 * PATCH /api/internal/orgs/[orgId]/feature-flags — write flags for one org
 * Pricing Console S2S — auth = Bearer INTERNAL_API_KEY.
 *
 * Flags are stored per-org in KV at "feature-flags:{orgId}".
 * Reads merge org overrides on top of global defaults so unset flags
 * always fall back to the product default.
 */
import { eq } from "drizzle-orm";
import { organizations } from "@/db/schema";
import { withInternalRoute, internalOk, internalError } from "@/lib/internal-api";
import { getFeatureFlags, setFeatureFlags, DEFAULT_FLAGS } from "@/lib/feature-flags";
import { z } from "zod";

const patchSchema = z.object({
  void_payments: z.boolean().optional(),
  recall_notify: z.boolean().optional(),
  consent_ai:   z.boolean().optional(),
});

export const GET = withInternalRoute<{ orgId: string }>(
  "GET /api/internal/orgs/[orgId]/feature-flags",
  async (_req, { db }, { orgId }) => {
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId));
    if (!org) return internalError("Org not found", 404);

    const flags = await getFeatureFlags(orgId);
    return internalOk({ flags, defaults: DEFAULT_FLAGS });
  }
);

export const PATCH = withInternalRoute<{ orgId: string }>(
  "PATCH /api/internal/orgs/[orgId]/feature-flags",
  async (req, { db }, { orgId }) => {
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId));
    if (!org) return internalError("Org not found", 404);

    let body: unknown;
    try { body = await req.json(); } catch { return internalError("Invalid JSON", 400); }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return internalError(parsed.error.errors[0].message, 400);
    if (Object.keys(parsed.data).length === 0) return internalError("No flags provided", 400);

    await setFeatureFlags(parsed.data, orgId);
    const updated = await getFeatureFlags(orgId);
    return internalOk({ flags: updated });
  }
);
