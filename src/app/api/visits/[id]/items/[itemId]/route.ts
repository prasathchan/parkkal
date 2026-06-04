import { NextRequest, NextResponse } from "next/server";
import { eq, and, sum } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visitItems, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const patchItemSchema = z.object({
  itemName: z.string().min(1).optional(),
  category: z.enum(["MEDICINE", "PROCEDURE", "XRAY", "CONSULTATION", "OTHER"]).optional(),
  toothNumber: z.string().optional().nullable(),
  quantity: z.number().min(0.01).optional(),
  unitPrice: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const db = getDb();

  const [visit] = await db
    .select({ status: visits.status })
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot modify items on a cancelled visit" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = patchItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.errors }, { status: 400 });
  }

  const data = parsed.data;
  const updates: Record<string, unknown> = {};
  if (data.itemName !== undefined) updates.itemName = data.itemName;
  if (data.category !== undefined) updates.category = data.category;
  if (data.toothNumber !== undefined) updates.toothNumber = data.toothNumber;
  if (data.notes !== undefined) updates.notes = data.notes;

  const qty = data.quantity;
  const price = data.unitPrice;

  if (qty !== undefined) updates.quantity = qty;
  if (price !== undefined) updates.unitPrice = price;

  // Recalc amount if qty or price changed
  if (qty !== undefined || price !== undefined) {
    const [existing] = await db
      .select()
      .from(visitItems)
      .where(and(eq(visitItems.id, itemId), eq(visitItems.visitId, id)));
    if (existing) {
      const newQty = qty ?? existing.quantity;
      const newPrice = price ?? existing.unitPrice;
      updates.amount = newQty * newPrice;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await db.update(visitItems).set(updates).where(and(eq(visitItems.id, itemId), eq(visitItems.visitId, id)));

  // Recompute total from all items — source of truth, prevents drift
  const [{ total }] = await db
    .select({ total: sum(visitItems.amount) })
    .from(visitItems)
    .where(eq(visitItems.visitId, id));
  await db.update(visits).set({ totalAmount: Number(total) || 0, updatedAt: Date.now() }).where(eq(visits.id, id));

  const [updated] = await db.select().from(visitItems).where(and(eq(visitItems.id, itemId), eq(visitItems.visitId, id)));
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const db = getDb();

  const [visit] = await db
    .select({ status: visits.status })
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot remove items from a cancelled visit" }, { status: 400 });
  }

  await db.delete(visitItems).where(and(eq(visitItems.id, itemId), eq(visitItems.visitId, id)));

  // Full recompute from remaining items — prevents drift if prior increment crashed
  const [{ total }] = await db
    .select({ total: sum(visitItems.amount) })
    .from(visitItems)
    .where(eq(visitItems.visitId, id));
  await db.update(visits).set({ totalAmount: Number(total) || 0, updatedAt: Date.now() }).where(eq(visits.id, id));

  return NextResponse.json({ success: true });
}
