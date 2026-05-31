import { NextRequest, NextResponse } from "next/server";
import { eq, sum } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visitItems, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const db = getDb();

  const [visit] = await db.select({ organizationId: visits.organizationId }).from(visits).where(eq(visits.id, id));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.organizationId !== session.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if ("itemName" in body) updates.itemName = body.itemName;
  if ("category" in body) updates.category = body.category;
  if ("toothNumber" in body) updates.toothNumber = body.toothNumber;
  if ("notes" in body) updates.notes = body.notes;

  const qty = "quantity" in body ? Number(body.quantity) : undefined;
  const price = "unitPrice" in body ? Number(body.unitPrice) : undefined;

  if (qty !== undefined) updates.quantity = qty;
  if (price !== undefined) updates.unitPrice = price;

  // Recalc amount if qty or price changed
  if (qty !== undefined || price !== undefined) {
    const [existing] = await db.select().from(visitItems).where(eq(visitItems.id, itemId));
    if (existing) {
      const newQty = qty ?? existing.quantity;
      const newPrice = price ?? existing.unitPrice;
      updates.amount = newQty * newPrice;
    }
  }

  await db.update(visitItems).set(updates).where(eq(visitItems.id, itemId));

  // Recalculate visit totalAmount
  const [{ total }] = await db
    .select({ total: sum(visitItems.amount) })
    .from(visitItems)
    .where(eq(visitItems.visitId, id));

  await db.update(visits).set({ totalAmount: Number(total) || 0, updatedAt: Date.now() }).where(eq(visits.id, id));

  const [updated] = await db.select().from(visitItems).where(eq(visitItems.id, itemId));
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

  const [visit] = await db.select({ organizationId: visits.organizationId }).from(visits).where(eq(visits.id, id));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.organizationId !== session.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const runDelete = async (tx: typeof db) => {
    await tx.delete(visitItems).where(eq(visitItems.id, itemId));
    const [{ total }] = await tx
      .select({ total: sum(visitItems.amount) })
      .from(visitItems)
      .where(eq(visitItems.visitId, id));
    await tx.update(visits).set({ totalAmount: Number(total) || 0, updatedAt: Date.now() }).where(eq(visits.id, id));
  };

  if (typeof (db as unknown as { transaction?: unknown }).transaction === "function") {
    await (db as unknown as { transaction: (fn: (tx: typeof db) => Promise<void>) => Promise<void> }).transaction(runDelete);
  } else {
    await runDelete(db);
  }

  return NextResponse.json({ success: true });
}
