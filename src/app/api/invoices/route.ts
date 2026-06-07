import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and, count, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { invoices, invoiceTreatments, patients, organizationPatients, treatments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { generateId } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const WRITE_RATE_LIMIT = { limit: 120, windowMs: 60_000 };

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

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("GET /api/invoices", session);
  if (!await hasPermission(session, PERMISSIONS.BILLING_VIEW)) {
    log.security("Permission denied: billing.view", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const patientIdFilter = searchParams.get("patientId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const db = getDb();

  const whereClause = patientIdFilter
    ? and(eq(invoices.organizationId, session.orgId), eq(invoices.patientId, patientIdFilter))
    : eq(invoices.organizationId, session.orgId);

  const [totalResult, rows] = await Promise.all([
    db.select({ count: count() }).from(invoices).where(whereClause),
    db
      .select({
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
      .where(whereClause)
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const total = totalResult[0]?.count ?? 0;
  return NextResponse.json({ invoices: rows, total, hasMore: offset + rows.length < total });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`write:${session.userId}`, WRITE_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const log = logger.forRoute("POST /api/invoices", session);

  if (!await hasPermission(session, PERMISSIONS.BILLING_CREATE)) {
    log.security("Permission denied: billing.create", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const now = Date.now();
    const status =
      data.paidAmount >= data.totalAmount && data.totalAmount > 0
        ? "PAID"
        : data.paidAmount > 0
        ? "PARTIAL"
        : "PENDING";

    const db = getDb();

    // Verify patient is an active member of this org
    const [patientOrgLink] = await db
      .select({ patientId: organizationPatients.patientId })
      .from(organizationPatients)
      .where(
        and(
          eq(organizationPatients.organizationId, session.orgId),
          eq(organizationPatients.patientId, data.patientId),
          eq(organizationPatients.isActive, 1)
        )
      );
    if (!patientOrgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Verify all referenced treatments belong to this org before linking
    if (data.treatmentIds && data.treatmentIds.length > 0) {
      const validTreatments = await db
        .select({ id: treatments.id })
        .from(treatments)
        .where(
          and(
            inArray(treatments.id, data.treatmentIds),
            eq(treatments.organizationId, session.orgId)
          )
        );
      if (validTreatments.length !== data.treatmentIds.length) {
        return NextResponse.json({ error: "One or more treatments are invalid" }, { status: 400 });
      }
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
      await db.insert(invoiceTreatments).values(
        data.treatmentIds.map((treatmentId) => ({ invoiceId, treatmentId }))
      );
    }

    log.info("Invoice created", { invoiceId, patientId: data.patientId, totalAmount: data.totalAmount });
    return NextResponse.json({ invoice: newInvoice }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    log.error("Failed to create invoice", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
