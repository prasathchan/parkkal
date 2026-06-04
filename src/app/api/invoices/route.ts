import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { invoices, invoiceTreatments, patients, organizationPatients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { z } from "zod";

const createSchema = z.object({
  patientId: z.string().min(1),
  totalAmount: z.number().min(0),
  paidAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
  treatmentIds: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const ALLOWED_ROLES = ["ADMIN", "RECEPTIONIST"];
  if (!ALLOWED_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const now = Date.now();
    const status =
      data.paidAmount >= data.totalAmount
        ? "PAID"
        : data.paidAmount > 0
        ? "PARTIAL"
        : "PENDING";

    const db = getDb();

    const [patientOrgLink] = await db.select().from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, data.patientId)));
    if (!patientOrgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

    // Link treatments to invoice if provided
    if (data.treatmentIds && data.treatmentIds.length > 0) {
      await db.insert(invoiceTreatments).values(
        data.treatmentIds.map((treatmentId) => ({ invoiceId, treatmentId }))
      );
    }

    return NextResponse.json({ invoice: newInvoice }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Create invoice error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
