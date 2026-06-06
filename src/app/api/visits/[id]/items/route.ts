import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visitItems, visits, treatments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

const createItemSchema = z.object({
  itemName: z.string().min(1),
  category: z.enum(["MEDICINE", "PROCEDURE", "XRAY", "CONSULTATION", "TREATMENT", "OTHER"]),
  toothNumber: z.string().optional(),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  notes: z.string().optional(),
  linkedTreatmentId: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await hasPermission(session, PERMISSIONS.BILLING_VIEW)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();
  const [visit] = await db
    .select({ organizationId: visits.organizationId })
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const items = await db.select().from(visitItems).where(eq(visitItems.visitId, id));
  return NextResponse.json({ items });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await hasPermission(session, PERMISSIONS.BILLING_CREATE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const { itemName, category, toothNumber, quantity, unitPrice, notes, linkedTreatmentId } = parsed;
  const qty = quantity;
  const price = unitPrice;
  const amount = qty * price;

  const db = getDb();

  const [visit] = await db
    .select({ status: visits.status, patientId: visits.patientId })
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (visit.status === "CANCELLED") return NextResponse.json({ error: "Cannot add items to a cancelled visit" }, { status: 400 });

  // Validate linked treatment if provided
  let resolvedTreatmentId: string | null = null;
  if (category === "TREATMENT" && linkedTreatmentId) {
    const [tx] = await db
      .select({ id: treatments.id })
      .from(treatments)
      .where(and(eq(treatments.id, linkedTreatmentId), eq(treatments.organizationId, session.orgId)));
    if (!tx) return NextResponse.json({ error: "Treatment plan not found" }, { status: 404 });
    resolvedTreatmentId = tx.id;
  }

  const newItem = {
    id: crypto.randomUUID(),
    visitId: id,
    itemName,
    category: category as "MEDICINE" | "PROCEDURE" | "XRAY" | "CONSULTATION" | "TREATMENT" | "OTHER",
    toothNumber: toothNumber || null,
    quantity: qty,
    unitPrice: price,
    amount,
    notes: notes || null,
    linkedTreatmentId: resolvedTreatmentId,
    createdAt: Date.now(),
  };

  await db.insert(visitItems).values(newItem);
  await db
    .update(visits)
    .set({ totalAmount: sql`total_amount + ${amount}`, updatedAt: Date.now() })
    .where(eq(visits.id, id));

  // Update treatment paidAmount so the treatment card shows accurate balance across visits
  if (resolvedTreatmentId) {
    await db
      .update(treatments)
      .set({ paidAmount: sql`paid_amount + ${amount}` })
      .where(eq(treatments.id, resolvedTreatmentId));
  }

  return NextResponse.json({ item: newItem }, { status: 201 });
}
