import { NextRequest, NextResponse } from "next/server";
import { eq, sum } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visitItems, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const createItemSchema = z.object({
  itemName: z.string().min(1),
  category: z.enum(["MEDICINE", "PROCEDURE", "XRAY", "CONSULTATION", "OTHER"]),
  toothNumber: z.string().optional(),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const [visit] = await db.select({ organizationId: visits.organizationId }).from(visits).where(eq(visits.id, id));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.organizationId !== session.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let parsed: z.infer<typeof createItemSchema>;
  try {
    parsed = createItemSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { itemName, category, toothNumber, quantity, unitPrice, notes } = parsed;
  const qty = quantity;
  const price = unitPrice;
  const amount = qty * price;

  const db = getDb();

  const [visit] = await db.select({ organizationId: visits.organizationId }).from(visits).where(eq(visits.id, id));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.organizationId !== session.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  // Insert item and update visit total atomically if transactions are supported
  const runInsert = async (tx: typeof db) => {
    await tx.insert(visitItems).values(newItem);
    const [{ total }] = await tx
      .select({ total: sum(visitItems.amount) })
      .from(visitItems)
      .where(eq(visitItems.visitId, id));
    await tx.update(visits).set({ totalAmount: Number(total) || 0, updatedAt: Date.now() }).where(eq(visits.id, id));
  };

  if (typeof (db as unknown as { transaction?: unknown }).transaction === "function") {
    await (db as unknown as { transaction: (fn: (tx: typeof db) => Promise<void>) => Promise<void> }).transaction(runInsert);
  } else {
    await runInsert(db);
  }

  return NextResponse.json({ item: newItem }, { status: 201 });
}
