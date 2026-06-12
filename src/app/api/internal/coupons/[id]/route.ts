/**
 * PUT /api/internal/coupons/[id] — update a coupon. Console S2S only.
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import { coupons } from "@/db/schema";
import { withInternalRoute, internalOk, internalError } from "@/lib/internal-api";

const schema = z.object({
  isActive: z.union([z.literal(0), z.literal(1)]).optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  validUntil: z.number().nullable().optional(),
});

export const PUT = withInternalRoute<{ id: string }>(
  "PUT /api/internal/coupons/[id]",
  async (req, { db }, { id }) => {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return internalError("Invalid payload", 422);

    const [coupon] = await db
      .update(coupons)
      .set({ ...parsed.data, updatedAt: Date.now() })
      .where(eq(coupons.id, id))
      .returning();
    if (!coupon) return internalError("Coupon not found", 404);

    return internalOk({ coupon });
  }
);
