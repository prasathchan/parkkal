import { NextRequest, NextResponse } from "next/server";
import { eq, sum } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visitItems, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const items = await db.select().from(visitItems).where(eq(visitItems.visitId, id));
  return NextResponse.json({ items });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { itemName, category, toothNumber, quantity, unitPrice, notes } = body;

  if (!itemName || !category) {
    return NextResponse.json({ error: "itemName and category are required" }, { status: 400 });
  }

  const qty = Number(quantity) || 1;
  const price = Number(unitPrice) || 0;
  const amount = qty * price;

  const db = getDb();
  const newItem = {
    id: crypto.randomUUID(),
    visitId: id,
    itemName,
    category: category as "MEDICINE" | "PROCEDURE" | "XRAY" | "CONSULTATION" | "OTHER",
    toothNumber: toothNumber || null,
    quantity: qty,
    unitPrice: price,
    amount,
    notes: notes || null,
    createdAt: Date.now(),
  };

  await db.insert(visitItems).values(newItem);

  // Recalculate visit totalAmount
  const [{ total }] = await db
    .select({ total: sum(visitItems.amount) })
    .from(visitItems)
    .where(eq(visitItems.visitId, id));

  await db.update(visits).set({ totalAmount: Number(total) || 0, updatedAt: Date.now() }).where(eq(visits.id, id));

  return NextResponse.json({ item: newItem }, { status: 201 });
}
