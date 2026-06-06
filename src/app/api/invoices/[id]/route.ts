import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { invoices, patients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { z } from "zod";

const patchSchema = z.object({
  paidAmount: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
});


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("GET /api/invoices/[id]", session);

  const { id } = await params;
  try {
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
        organizationId: invoices.organizationId,
        patientName: patients.name,
      })
      .from(invoices)
      .leftJoin(patients, eq(invoices.patientId, patients.id))
      .where(and(eq(invoices.id, id), eq(invoices.organizationId, session.orgId)));

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ invoice: rows[0] });
  } catch (err) {
    log.error("Failed to fetch invoice", err, { invoiceId: id });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const BILLING_ROLES = ["ADMIN", "RECEPTIONIST"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("PATCH /api/invoices/[id]", session);
  if (!BILLING_ROLES.includes(session.role)) {
    log.security("Permission denied: billing role required to update invoice", { role: session.role });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);

    const db = getDb();

    // Fetch existing invoice for org isolation check
    const existing = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.organizationId, session.orgId)));

    if (existing.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const current = existing[0];
    const newPaidAmount = data.paidAmount !== undefined ? data.paidAmount : current.paidAmount;
    const totalAmount = current.totalAmount;

    if (newPaidAmount > totalAmount + 0.001) {
      return NextResponse.json({ error: `Paid amount ₹${newPaidAmount.toFixed(2)} exceeds invoice total ₹${totalAmount.toFixed(2)}` }, { status: 400 });
    }

    const status: "PAID" | "PARTIAL" | "PENDING" =
      newPaidAmount >= totalAmount
        ? "PAID"
        : newPaidAmount > 0
        ? "PARTIAL"
        : "PENDING";

    const updates: Record<string, unknown> = {
      paidAmount: newPaidAmount,
      status,
      updatedAt: Date.now(),
    };

    if (data.notes !== undefined) {
      updates.notes = data.notes;
    }

    await db
      .update(invoices)
      .set(updates)
      .where(and(eq(invoices.id, id), eq(invoices.organizationId, session.orgId)));

    const updated = await db
      .select({
        id: invoices.id,
        patientId: invoices.patientId,
        totalAmount: invoices.totalAmount,
        paidAmount: invoices.paidAmount,
        status: invoices.status,
        notes: invoices.notes,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
      })
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.organizationId, session.orgId)));

    log.info("Invoice updated", { invoiceId: id, status, newPaidAmount });
    return NextResponse.json({ invoice: updated[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    log.error("Failed to update invoice", error, { invoiceId: id });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
