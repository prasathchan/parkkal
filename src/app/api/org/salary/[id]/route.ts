import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { salaryRecords } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const WRITE_RATE_LIMIT = { limit: 120, windowMs: 60_000 };

const patchSchema = z.object({
  status: z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
  paidAmount: z.number().min(0).optional(),
  paidAt: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`write:${session.userId}`, WRITE_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const log = logger.forRoute("PATCH /api/org/salary/[id]", session);
  const { id } = await params;
  if (!(await hasPermission(session, PERMISSIONS.SALARY_MANAGE))) {
    log.security("Permission denied: salary.manage", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.errors }, { status: 400 });
    }

    const data = parsed.data;
    const db = getDb();

    const [record] = await db
      .select({ id: salaryRecords.id, salaryAmount: salaryRecords.salaryAmount, paidAmount: salaryRecords.paidAmount })
      .from(salaryRecords)
      .where(and(eq(salaryRecords.id, id), eq(salaryRecords.organizationId, session.orgId)));
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Guard: paid amount cannot exceed salary amount
    const newPaid = data.paidAmount ?? record.paidAmount;
    if (newPaid > record.salaryAmount + 0.001) {
      return NextResponse.json({ error: `Paid amount ₹${newPaid.toFixed(2)} exceeds salary ₹${record.salaryAmount.toFixed(2)}` }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (data.status !== undefined) updates.status = data.status;
    if (data.paidAmount !== undefined) updates.paidAmount = data.paidAmount;
    if (data.paidAt !== undefined) updates.paidAt = data.paidAt;
    if (data.notes !== undefined) updates.notes = data.notes;

    await db.update(salaryRecords).set(updates).where(
      and(eq(salaryRecords.id, id), eq(salaryRecords.organizationId, session.orgId))
    );
    log.info("Salary record updated", { salaryRecordId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    log.error("Failed to update salary record", error, { salaryRecordId: id });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
