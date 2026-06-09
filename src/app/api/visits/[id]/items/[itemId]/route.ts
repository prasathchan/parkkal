import { eq, and, sum } from "drizzle-orm";
import { visitItems, visits } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const patchItemSchema = z.object({
  itemName: z.string().min(1).optional(),
  category: z.enum(["MEDICINE", "PROCEDURE", "XRAY", "CONSULTATION", "TREATMENT", "OTHER"]).optional(),
  toothNumber: z.string().optional().nullable(),
  quantity: z.number().min(0.01).optional(),
  unitPrice: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
});

export const PATCH = withRoute<{ id: string; itemId: string }>(
  { route: "PATCH /api/visits/[id]/items/[itemId]", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.BILLING_EDIT },
  async (req, { session, db, log }, { id, itemId }) => {
    const [visit] = await db
      .select({ status: visits.status })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Visit not found", 404);
    if (visit.status === "CANCELLED") return apiError("Cannot modify items on a cancelled visit", 400);

    const data = patchItemSchema.parse(await req.json());

    const updates: Record<string, unknown> = {};
    if (data.itemName !== undefined) updates.itemName = data.itemName;
    if (data.category !== undefined) updates.category = data.category;
    if (data.toothNumber !== undefined) updates.toothNumber = data.toothNumber;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.quantity !== undefined) updates.quantity = data.quantity;
    if (data.unitPrice !== undefined) updates.unitPrice = data.unitPrice;

    // Recalc amount if qty or price changed
    if (data.quantity !== undefined || data.unitPrice !== undefined) {
      const [existing] = await db
        .select()
        .from(visitItems)
        .where(and(eq(visitItems.id, itemId), eq(visitItems.visitId, id)));
      if (existing) {
        const newQty = data.quantity ?? existing.quantity;
        const newPrice = data.unitPrice ?? existing.unitPrice;
        updates.amount = newQty * newPrice;
      }
    }

    if (Object.keys(updates).length === 0) return apiError("No fields to update", 400);

    await db.update(visitItems).set(updates).where(and(eq(visitItems.id, itemId), eq(visitItems.visitId, id)));

    // Recompute total from all items — source of truth, prevents drift
    const [{ total }] = await db
      .select({ total: sum(visitItems.amount) })
      .from(visitItems)
      .where(eq(visitItems.visitId, id));
    await db.update(visits).set({ totalAmount: Number(total) || 0, updatedAt: Date.now() }).where(eq(visits.id, id));

    const [updated] = await db.select().from(visitItems).where(and(eq(visitItems.id, itemId), eq(visitItems.visitId, id)));
    log.info("Visit item updated", { itemId, visitId: id });
    return apiOk({ item: updated });
  }
);

export const DELETE = withRoute<{ id: string; itemId: string }>(
  { route: "DELETE /api/visits/[id]/items/[itemId]", rateLimit: RATE_LIMITS.DESTRUCTIVE, permission: PERMISSIONS.BILLING_EDIT },
  async (_req, { session, db, log }, { id, itemId }) => {
    const [visit] = await db
      .select({ status: visits.status })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Visit not found", 404);
    if (visit.status === "CANCELLED") return apiError("Cannot remove items from a cancelled visit", 400);

    await db.delete(visitItems).where(and(eq(visitItems.id, itemId), eq(visitItems.visitId, id)));

    // Full recompute from remaining items — prevents drift if prior increment crashed
    const [{ total }] = await db
      .select({ total: sum(visitItems.amount) })
      .from(visitItems)
      .where(eq(visitItems.visitId, id));
    await db.update(visits).set({ totalAmount: Number(total) || 0, updatedAt: Date.now() }).where(eq(visits.id, id));

    log.info("Visit item deleted", { itemId, visitId: id });
    return apiOk({ success: true });
  }
);
