import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { invoices, patients } from "@/db/schema";
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

  const db = getDb();

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
      patientName: patients.name,
    })
    .from(invoices)
    .leftJoin(patients, eq(invoices.patientId, patients.id))
    .where(patientIdFilter
      ? and(eq(invoices.organizationId, session.orgId), eq(invoices.patientId, patientIdFilter))
      : eq(invoices.organizationId, session.orgId)
    )
    .orderBy(desc(invoices.createdAt))
    ;

  return NextResponse.json({ invoices: rows });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const newInvoice = {
      id: generateId(),
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
    return NextResponse.json({ invoice: newInvoice }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
