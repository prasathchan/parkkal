/**
 * PUT /api/internal/plans/[id] — update plan pricing/limits. Console S2S only.
 */

import { z } from "zod";
import { eq } from "drizzle-orm";
import { subscriptionPlans } from "@/db/schema";
import { withInternalRoute, internalOk, internalError } from "@/lib/internal-api";

const schema = z.object({
  priceMonthly: z.number().int().min(0).optional(),
  maxDoctors: z.number().int().min(1).nullable().optional(),
  maxStaff: z.number().int().min(1).nullable().optional(),
  features: z.array(z.string()).optional(),
  isActive: z.union([z.literal(0), z.literal(1)]).optional(),
  description: z.string().max(500).optional(),
});

export const PUT = withInternalRoute<{ id: string }>(
  "PUT /api/internal/plans/[id]",
  async (req, { db }, { id }) => {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return internalError("Invalid payload", 422);

    const { features, ...rest } = parsed.data;
    const updates: Record<string, unknown> = { ...rest, updatedAt: Date.now() };
    if (features) updates.features = JSON.stringify(features);

    const [plan] = await db
      .update(subscriptionPlans)
      .set(updates)
      .where(eq(subscriptionPlans.id, id))
      .returning();
    if (!plan) return internalError("Plan not found", 404);

    return internalOk({ plan });
  }
);
