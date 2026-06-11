import { eq } from "drizzle-orm";
import { z } from "zod";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { coupons } from "@/db/schema";
import { isSuperAdmin } from "@/lib/superadmin";

const updateSchema = z.object({
  description:   z.string().max(200).optional(),
  discountType:  z.enum(["percent", "amount"]).optional(),
  discountValue: z.number().positive().optional(),
  maxUses:       z.number().int().positive().nullable().optional(),
  validFrom:     z.number().nullable().optional(),
  validUntil:    z.number().nullable().optional(),
  planSlug:      z.string().nullable().optional(),
  isActive:      z.boolean().optional(),
});

export const PUT = withRoute<{ id: string }>(
  { route: "PUT /api/superadmin/coupons/[id]", rateLimit: RATE_LIMITS.WRITE, skipSubscriptionCheck: true },
  async (req, { session, db }, { id }) => {
    if (!await isSuperAdmin(db, session.userId)) return apiError("Forbidden", 403);
    const body = updateSchema.parse(await req.json());
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (body.description   !== undefined) updates.description   = body.description;
    if (body.discountType  !== undefined) updates.discountType  = body.discountType;
    if (body.discountValue !== undefined) updates.discountValue = body.discountValue;
    if (body.maxUses       !== undefined) updates.maxUses       = body.maxUses;
    if (body.validFrom     !== undefined) updates.validFrom     = body.validFrom;
    if (body.validUntil    !== undefined) updates.validUntil    = body.validUntil;
    if (body.planSlug      !== undefined) updates.planSlug      = body.planSlug;
    if (body.isActive      !== undefined) updates.isActive      = body.isActive ? 1 : 0;
    await db.update(coupons).set(updates).where(eq(coupons.id, id));
    return apiOk({ updated: true });
  }
);
