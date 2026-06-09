import { eq, and } from "drizzle-orm";
import { invoices, patients } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const patchSchema = z.object({
  paidAmount: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
});

const BILLING_ROLES = ["ADMIN", "RECEPTIONIST"];

/** GET /api/invoices/[id] — fetch a single invoice */
export const GET = withRoute<{ id: string }>(
  { route: "GET /api/invoices/[id]" },
  async (_req, { session, db }, { id }) => {
    const rows = await db
      .select({
        id: invoices.id,
        patientId: invoices.patientId,
        totalAmount: invoices.totalAmount,
        paidAmount: invoices.paidAmount,
        status: invoices.status,
        notes: invoices.notes,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
        organizationId: invoices.organizationId,
        patientName: patients.name,
      })
      .from(invoices)
      .leftJoin(patients, eq(invoices.patientId, patients.id))
      .where(and(eq(invoices.id, id), eq(invoices.organizationId, session.orgId)));

    if (rows.length === 0) return apiError("Not found", 404);
    return apiOk({ invoice: rows[0] });
  }
);

/** PATCH /api/invoices/[id] — update paidAmount or notes (ADMIN/RECEPTIONIST only) */
export const PATCH = withRoute<{ id: string }>(
  { route: "PATCH /api/invoices/[id]", rateLimit: RATE_LIMITS.WRITE },
  async (req, { session, db, log }, { id }) => {
    if (!BILLING_ROLES.includes(session.role)) {
      log.security("Permission denied: billing role required to update invoice", { role: session.role });
      return apiError("Forbidden", 403);
    }

    const data = patchSchema.parse(await req.json());

    const [current] = await db.select().from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.organizationId, session.orgId)));
    if (!current) return apiError("Not found", 404);

    const newPaidAmount = data.paidAmount !== undefined ? data.paidAmount : current.paidAmount;

    if (newPaidAmount > current.totalAmount + 0.001) {
      return apiError(`Paid amount ₹${newPaidAmount.toFixed(2)} exceeds invoice total ₹${current.totalAmount.toFixed(2)}`, 400);
    }

    const status: "PAID" | "PARTIAL" | "PENDING" =
      newPaidAmount >= current.totalAmount ? "PAID" :
      newPaidAmount > 0 ? "PARTIAL" : "PENDING";

    const updates: Record<string, unknown> = { paidAmount: newPaidAmount, status, updatedAt: Date.now() };
    if (data.notes !== undefined) updates.notes = data.notes;

    await db.update(invoices).set(updates).where(and(eq(invoices.id, id), eq(invoices.organizationId, session.orgId)));

    const [updated] = await db.select({
      id: invoices.id,
      patientId: invoices.patientId,
      totalAmount: invoices.totalAmount,
      paidAmount: invoices.paidAmount,
      status: invoices.status,
      notes: invoices.notes,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
    }).from(invoices).where(and(eq(invoices.id, id), eq(invoices.organizationId, session.orgId)));

    log.info("Invoice updated", { invoiceId: id, status, newPaidAmount });
    return apiOk({ invoice: updated });
  }
);
