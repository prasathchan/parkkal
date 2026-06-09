import { eq, and } from "drizzle-orm";
import { salaryRecords } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
  paidAmount: z.number().min(0).optional(),
  paidAt: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/** PATCH /api/org/salary/[id] — mark payment status on a salary record */
export const PATCH = withRoute<{ id: string }>(
  { route: "PATCH /api/org/salary/[id]", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.SALARY_MANAGE },
  async (req, { session, db, log }, { id }) => {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Invalid input", 400);

    const [record] = await db
      .select({ id: salaryRecords.id, salaryAmount: salaryRecords.salaryAmount, paidAmount: salaryRecords.paidAmount })
      .from(salaryRecords)
      .where(and(eq(salaryRecords.id, id), eq(salaryRecords.organizationId, session.orgId)));
    if (!record) return apiError("Not found", 404);

    const data = parsed.data;
    const newPaid = data.paidAmount ?? record.paidAmount;
    if (newPaid > record.salaryAmount + 0.001) {
      return apiError(`Paid amount ₹${newPaid.toFixed(2)} exceeds salary ₹${record.salaryAmount.toFixed(2)}`, 400);
    }

    const updates: Record<string, unknown> = {};
    if (data.status !== undefined) updates.status = data.status;
    if (data.paidAmount !== undefined) updates.paidAmount = data.paidAmount;
    if (data.paidAt !== undefined) updates.paidAt = data.paidAt;
    if (data.notes !== undefined) updates.notes = data.notes;

    await db.update(salaryRecords).set(updates).where(and(eq(salaryRecords.id, id), eq(salaryRecords.organizationId, session.orgId)));
    log.info("Salary record updated", { salaryRecordId: id });
    return apiOk({ success: true });
  }
);
