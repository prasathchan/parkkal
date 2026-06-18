import { desc } from "drizzle-orm";
import { z } from "zod";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { coupons } from "@/db/schema";
import { isSuperAdmin } from "@/lib/superadmin";
import { requireSuperadminToken, logSuperadminAction } from "@/lib/superadmin-auth";

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
  async (req, { session, db, log }) => {
    if (!await isSuperAdmin(db, session.userId)) return apiError("Forbidden", 403);
    if (!await requireSuperadminToken(req, session.userId)) {
      log.security("Superadmin route accessed without valid superadmin session token", {});
      return apiError("Superadmin session token required. Call POST /api/superadmin/auth first.", 401);
    }
    await logSuperadminAction(session.userId, "LIST_COUPONS");
    const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
    return apiOk({ coupons: rows });
  }
);

export const POST = withRoute(
  { route: "POST /api/superadmin/coupons", rateLimit: RATE_LIMITS.WRITE, skipSubscriptionCheck: true },
  async (req, { session, db, log }) => {
    if (!await isSuperAdmin(db, session.userId)) return apiError("Forbidden", 403);
    if (!await requireSuperadminToken(req, session.userId)) {
      log.security("Superadmin route accessed without valid superadmin session token", {});
      return apiError("Superadmin session token required. Call POST /api/superadmin/auth first.", 401);
    }
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
    await logSuperadminAction(session.userId, "CREATE_COUPON", { couponId: id, code: body.code });
    return apiOk({ id }, 201);
  }
);
