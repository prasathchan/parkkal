import { desc } from "drizzle-orm";
import { z } from "zod";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";
import { coupons } from "@/db/schema";
import { isSuperAdmin } from "@/lib/superadmin";
import { apiError } from "@/lib/api";

const couponSchema = z.object({
  code:          z.string().min(2).max(40).toUpperCase(),
  description:   z.string().max(200).optional(),
  discountType:  z.enum(["percent", "amount"]),
  discountValue: z.number().positive(),
  maxUses:       z.number().int().positive().nullable().optional(),
  validFrom:     z.number().optional(),
  validUntil:    z.number().optional(),
  planSlug:      z.string().optional().nullable(),
  isActive:      z.boolean().optional().default(true),
});

export const GET = withRoute(
  { route: "GET /api/superadmin/coupons", rateLimit: RATE_LIMITS.READ, skipSubscriptionCheck: true },
  async (_req, { session, db }) => {
    if (!await isSuperAdmin(db, session.userId)) return apiError("Forbidden", 403);
    const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
    return apiOk({ coupons: rows });
  }
);

export const POST = withRoute(
  { route: "POST /api/superadmin/coupons", rateLimit: RATE_LIMITS.WRITE, skipSubscriptionCheck: true },
  async (req, { session, db }) => {
    if (!await isSuperAdmin(db, session.userId)) return apiError("Forbidden", 403);
    const body = couponSchema.parse(await req.json());
    const now  = Date.now();
    const id   = `cpn_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    await db.insert(coupons).values({
      id,
      code:          body.code,
      description:   body.description ?? null,
      discountType:  body.discountType,
      discountValue: body.discountValue,
      maxUses:       body.maxUses ?? null,
      usedCount:     0,
      validFrom:     body.validFrom ?? null,
      validUntil:    body.validUntil ?? null,
      planSlug:      body.planSlug ?? null,
      isActive:      body.isActive ? 1 : 0,
      createdAt:     now,
      updatedAt:     now,
    });
    return apiOk({ id }, 201);
  }
);
