import { eq, and, inArray } from "drizzle-orm";
import { appointments } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const bodySchema = z.object({
  ids:    z.array(z.string().min(1)).min(1).max(50),
  status: z.enum(["COMPLETED", "NO_SHOW"]),
});

export const POST = withRoute(
  { route: "POST /api/appointments/bulk-status", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.APPOINTMENTS_EDIT },
  async (req, { session, db }) => {
    const body = bodySchema.safeParse(await req.json());
    if (!body.success) return apiError("Invalid request", 422);

    const { ids, status } = body.data;

    // Verify all appointments belong to this org before updating
    const existing = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(
        eq(appointments.organizationId, session.orgId),
        inArray(appointments.id, ids),
      ));

    if (existing.length === 0) return apiError("No matching appointments found", 404);

    const validIds = existing.map((a: { id: string }) => a.id);

    await db
      .update(appointments)
      .set({ status, updatedAt: Date.now() })
      .where(and(
        eq(appointments.organizationId, session.orgId),
        inArray(appointments.id, validIds),
      ));

    return apiOk({ updated: validIds.length });
  }
);
