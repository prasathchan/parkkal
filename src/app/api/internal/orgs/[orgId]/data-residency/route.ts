/**
 * GET  /api/internal/orgs/[orgId]/data-residency — read org data region
 * PATCH /api/internal/orgs/[orgId]/data-residency — set org data region
 * Pricing Console S2S — auth = Bearer INTERNAL_API_KEY.
 */
import { eq } from "drizzle-orm";
import { organizations } from "@/db/schema";
import { withInternalRoute, internalOk, internalError } from "@/lib/internal-api";
import { z } from "zod";

const DATA_REGIONS = ["global", "india", "eu"] as const;

const patchSchema = z.object({
  dataRegion: z.enum(DATA_REGIONS),
});

export const GET = withInternalRoute<{ orgId: string }>(
  "GET /api/internal/orgs/[orgId]/data-residency",
  async (_req, { db }, { orgId }) => {
    const [org] = await db
      .select({ id: organizations.id, name: organizations.name, dataRegion: organizations.dataRegion })
      .from(organizations)
      .where(eq(organizations.id, orgId));
    if (!org) return internalError("Org not found", 404);

    return internalOk({ orgId: org.id, orgName: org.name, dataRegion: org.dataRegion ?? "global" });
  }
);

export const PATCH = withInternalRoute<{ orgId: string }>(
  "PATCH /api/internal/orgs/[orgId]/data-residency",
  async (req, { db }, { orgId }) => {
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId));
    if (!org) return internalError("Org not found", 404);

    let body: unknown;
    try { body = await req.json(); } catch { return internalError("Invalid JSON", 400); }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return internalError(parsed.error.errors[0].message, 400);

    await db
      .update(organizations)
      .set({ dataRegion: parsed.data.dataRegion, updatedAt: Date.now() })
      .where(eq(organizations.id, orgId));

    return internalOk({ orgId, dataRegion: parsed.data.dataRegion });
  }
);
