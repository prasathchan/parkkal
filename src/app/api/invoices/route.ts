import { eq, desc, and, count, inArray } from "drizzle-orm";
import { invoices, invoiceTreatments, patients, organizationPatients, treatments } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { generateId } from "@/lib/utils";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const createSchema = z.object({
  patientId: z.string().min(1),
  totalAmount: z.number().min(0),
  paidAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
  treatmentIds: z.array(z.string()).optional(),
}).refine((d) => d.paidAmount <= d.totalAmount, {
  message: "paidAmount cannot exceed totalAmount",
  path: ["paidAmount"],
});

/** GET /api/invoices — list invoices for the org (optionally filtered by patient) */
export const GET = withRoute(
  { route: "GET /api/invoices", permission: PERMISSIONS.BILLING_VIEW },
  async (req, { session, db }) => {
    const { searchParams } = new URL(req.url);
    const patientIdFilter = searchParams.get("patientId");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const where = patientIdFilter
      ? and(eq(invoices.organizationId, session.orgId), eq(invoices.patientId, patientIdFilter))
      : eq(invoices.organizationId, session.orgId);

    const [totalResult, rows] = await Promise.all([
      db.select({ count: count() }).from(invoices).where(where),
      db.select({
        id: invoices.id,
        patientId: invoices.patientId,
        totalAmount: invoices.totalAmount,
        paidAmount: invoices.paidAmount,
        status: invoices.status,
        notes: invoices.notes,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
        patientName: patients.name,
      })
      .from(invoices)
      .leftJoin(patients, eq(invoices.patientId, patients.id))
      .where(where)
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return apiOk({ invoices: rows, total, hasMore: offset + rows.length < total });
  }
);

/** POST /api/invoices — create a new invoice */
export const POST = withRoute(
  { route: "POST /api/invoices", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.BILLING_CREATE },
  async (req, { session, db, log }) => {
    const data = createSchema.parse(await req.json());
    const now = Date.now();
    const status =
      data.paidAmount >= data.totalAmount && data.totalAmount > 0 ? "PAID" :
      data.paidAmount > 0 ? "PARTIAL" : "PENDING";

    // Verify patient is an active member of this org
    const [patientOrgLink] = await db.select({ patientId: organizationPatients.patientId })
      .from(organizationPatients)
      .where(and(
        eq(organizationPatients.organizationId, session.orgId),
        eq(organizationPatients.patientId, data.patientId),
        eq(organizationPatients.isActive, 1)
      ));
    if (!patientOrgLink) return apiError("Forbidden", 403);

    // Verify all referenced treatments belong to this org
    if (data.treatmentIds && data.treatmentIds.length > 0) {
      const valid = await db.select({ id: treatments.id }).from(treatments)
        .where(and(inArray(treatments.id, data.treatmentIds), eq(treatments.organizationId, session.orgId)));
      if (valid.length !== data.treatmentIds.length) return apiError("One or more treatments are invalid", 400);
    }

    const invoiceId = generateId();
    const newInvoice = {
      id: invoiceId,
      organizationId: session.orgId,
      patientId: data.patientId,
      totalAmount: data.totalAmount,
      paidAmount: data.paidAmount,
      status: status as "PENDING" | "PARTIAL" | "PAID",
      notes: data.notes || null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(invoices).values(newInvoice);

    if (data.treatmentIds && data.treatmentIds.length > 0) {
      await db.insert(invoiceTreatments).values(data.treatmentIds.map((treatmentId) => ({ invoiceId, treatmentId })));
    }

    log.info("Invoice created", { invoiceId, patientId: data.patientId, totalAmount: data.totalAmount });
    return apiOk({ invoice: newInvoice }, 201);
  }
);
