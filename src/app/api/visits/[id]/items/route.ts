/**
 * API Route: /api/visits/[id]/items
 *
 * GET  — List all bill items for a visit
 * POST — Add a new bill item (updates visit.totalAmount automatically)
 *
 * Item categories: MEDICINE | PROCEDURE | XRAY | CONSULTATION | TREATMENT | OTHER
 * When category = TREATMENT, pass linkedTreatmentId to track partial payments
 * for multi-session treatment plans across multiple visits.
 *
 * Who can call this: billing.view (GET) / billing.create (POST)
 */
import { eq, and, sql } from "drizzle-orm";
import { visitItems, visits, treatments } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
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

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/visits/[id]/items", permission: PERMISSIONS.BILLING_VIEW },
  async (_req, { session, db }, { id }) => {
    const [visit] = await db
      .select({ organizationId: visits.organizationId })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Not found", 404);

    const items = await db.select().from(visitItems).where(eq(visitItems.visitId, id));
    return apiOk({ items });
  }
);

export const POST = withRoute<{ id: string }>(
  { route: "POST /api/visits/[id]/items", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.BILLING_CREATE },
  async (req, { session, db, log }, { id }) => {
    const parsed = createItemSchema.parse(await req.json());
    const { itemName, category, toothNumber, quantity, unitPrice, notes, linkedTreatmentId } = parsed;
    const amount = quantity * unitPrice;

    const [visit] = await db
      .select({ status: visits.status, patientId: visits.patientId })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Not found", 404);
    if (visit.status === "CANCELLED") return apiError("Cannot add items to a cancelled visit", 400);

    // Validate linked treatment if provided
    let resolvedTreatmentId: string | null = null;
    if (category === "TREATMENT" && linkedTreatmentId) {
      const [tx] = await db
        .select({ id: treatments.id })
        .from(treatments)
        .where(and(eq(treatments.id, linkedTreatmentId), eq(treatments.organizationId, session.orgId)));
      if (!tx) return apiError("Treatment plan not found", 404);
      resolvedTreatmentId = tx.id;
    }

    const newItem = {
      id: crypto.randomUUID(),
      visitId: id,
      itemName,
      category: category as "MEDICINE" | "PROCEDURE" | "XRAY" | "CONSULTATION" | "TREATMENT" | "OTHER",
      toothNumber: toothNumber || null,
      quantity,
      unitPrice,
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

    log.info("Visit item added", { itemId: newItem.id, visitId: id, category, amount });
    return apiOk({ item: newItem }, 201);
  }
);
