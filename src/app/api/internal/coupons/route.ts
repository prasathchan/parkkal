/**
 * GET  /api/internal/coupons — all coupons. Console S2S only.
 * POST /api/internal/coupons — create one coupon (code) or bulk-generate
 *      unique codes ({ bulk: { prefix, quantity } }). Codes are PREFIX-XXXXXX
 *      using an unambiguous alphabet (no 0/O/1/I).
 */

import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { coupons } from "@/db/schema";
import { withInternalRoute, internalOk, internalError } from "@/lib/internal-api";

export const GET = withInternalRoute("GET /api/internal/coupons", async (_req, { db }) => {
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  return internalOk({ coupons: rows });
});

const schema = z.object({
  code: z.string().regex(/^[A-Z0-9-]{4,32}$/).optional(),
  bulk: z.object({
    prefix: z.string().regex(/^[A-Z0-9]{2,12}$/),
    quantity: z.number().int().min(1).max(500),
  }).optional(),
  description: z.string().max(300).optional(),
  discountType: z.enum(["percent", "amount"]),
  discountValue: z.number().min(1),
  maxUses: z.number().int().min(1).nullable().optional(),
  validUntil: z.number().nullable().optional(),
  planSlug: z.string().nullable().optional(),
}).refine((d) => d.code || d.bulk, { message: "code or bulk required" });

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function randomCode(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes).map((b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${prefix}-${suffix}`;
}

export const POST = withInternalRoute("POST /api/internal/coupons", async (req, { db }) => {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return internalError("Invalid payload", 422);
  const data = parsed.data;

  if (data.discountType === "percent" && data.discountValue > 100) {
    return internalError("Percent discount cannot exceed 100", 422);
  }

  const now = Date.now();
  const codes: string[] = data.bulk
    ? Array.from({ length: data.bulk.quantity }, () => randomCode(data.bulk!.prefix))
    : [data.code!];

  // Bulk codes have 32^6 ≈ 1e9 combinations per prefix — collisions are
  // unlikely but the UNIQUE constraint is the backstop; dedupe within batch.
  const unique = [...new Set(codes)];

  const created: typeof coupons.$inferSelect[] = [];
  for (const code of unique) {
    const [existing] = await db.select({ id: coupons.id }).from(coupons).where(eq(coupons.code, code));
    if (existing) {
      if (!data.bulk) return internalError(`Coupon code ${code} already exists`, 409);
      continue; // bulk: silently skip the rare collision
    }
    const [row] = await db
      .insert(coupons)
      .values({
        id: crypto.randomUUID(),
        code,
        description: data.description ?? null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxUses: data.maxUses ?? null,
        validUntil: data.validUntil ?? null,
        planSlug: data.planSlug ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    created.push(row);
  }

  return internalOk({ coupons: created }, 201);
});
