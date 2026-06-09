import { eq, and } from "drizzle-orm";
import { prescriptions, visits } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const medicineSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  duration: z.string().min(1),
  notes: z.string().optional(),
});

const createSchema = z.object({
  medicines: z.array(medicineSchema).min(1),
  instructions: z.string().optional(),
});

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/visits/[id]/prescriptions", permission: PERMISSIONS.VISITS_VIEW },
  async (_req, { session, db }, { id }) => {
    const [visit] = await db
      .select({ organizationId: visits.organizationId })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Visit not found", 404);

    const rows = await db
      .select()
      .from(prescriptions)
      .where(and(eq(prescriptions.visitId, id), eq(prescriptions.organizationId, session.orgId)));

    return apiOk({ prescriptions: rows });
  }
);

export const POST = withRoute<{ id: string }>(
  { route: "POST /api/visits/[id]/prescriptions", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.VISITS_EDIT },
  async (req, { session, db, log }, { id }) => {
    // Fetch visit to get authoritative patientId/doctorId — never trust caller for these
    const [visit] = await db
      .select({ organizationId: visits.organizationId, patientId: visits.patientId, doctorId: visits.doctorId, status: visits.status })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Visit not found", 404);

    if (visit.status === "CANCELLED") return apiError("Cannot add prescription to a cancelled visit", 400);

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Invalid request", 400);

    const data = parsed.data;
    const rxId = crypto.randomUUID();
    const now = Date.now();

    const [prescription] = await db
      .insert(prescriptions)
      .values({
        id: rxId,
        organizationId: session.orgId,
        visitId: id,
        patientId: visit.patientId,
        doctorId: visit.doctorId,
        medicines: JSON.stringify(data.medicines),
        instructions: data.instructions ?? null,
        createdAt: now,
      })
      .returning();

    log.info("Prescription created", { prescriptionId: rxId, visitId: id });
    return apiOk({ prescription }, 201);
  }
);
