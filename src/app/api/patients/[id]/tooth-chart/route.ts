import { eq, and } from "drizzle-orm";
import { toothChart, organizationPatients } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";
import { randomUUID } from "crypto";

const toothDataSchema = z.record(
  z.string().regex(/^[1-4][1-8]$/),
  z.object({
    condition: z.enum([
      "HEALTHY", "CARIES", "FILLING", "CROWN", "MISSING",
      "ROOT_CANAL", "BRIDGE", "IMPLANT", "FRACTURED", "WATCH",
    ]),
    notes: z.string().max(200).optional(),
  })
);

/** GET /api/patients/[id]/tooth-chart */
export const GET = withRoute(
  { route: "GET /api/patients/[id]/tooth-chart", permission: PERMISSIONS.PATIENTS_VIEW, rateLimit: RATE_LIMITS.READ },
  async (_req, { session, db }, params) => {
    const patientId = (params as Record<string, string>).id;

    // Verify patient belongs to this org
    const [link] = await db.select({ id: organizationPatients.id })
      .from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, patientId)))
      .limit(1);
    if (!link) return apiError("Patient not found", 404);

    const [chart] = await db.select()
      .from(toothChart)
      .where(and(eq(toothChart.organizationId, session.orgId), eq(toothChart.patientId, patientId)))
      .limit(1);

    return apiOk({
      toothData: chart ? (JSON.parse(chart.toothData) as Record<string, unknown>) : {},
      updatedAt: chart?.updatedAt ?? null,
    });
  }
);

/** PUT /api/patients/[id]/tooth-chart */
export const PUT = withRoute(
  { route: "PUT /api/patients/[id]/tooth-chart", permission: PERMISSIONS.PATIENTS_EDIT, rateLimit: RATE_LIMITS.WRITE },
  async (req, { session, db }, params) => {
    const patientId = (params as Record<string, string>).id;

    // Verify patient belongs to this org
    const [link] = await db.select({ id: organizationPatients.id })
      .from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, patientId)))
      .limit(1);
    if (!link) return apiError("Patient not found", 404);

    const body = await req.json() as Record<string, unknown>;
    const parsed = toothDataSchema.safeParse(body.toothData ?? {});
    if (!parsed.success) return apiError("Invalid tooth data", 400);

    const now = Date.now();
    const existing = await db.select({ id: toothChart.id })
      .from(toothChart)
      .where(and(eq(toothChart.organizationId, session.orgId), eq(toothChart.patientId, patientId)))
      .limit(1);

    if (existing.length > 0) {
      await db.update(toothChart)
        .set({ toothData: JSON.stringify(parsed.data), updatedAt: now, updatedBy: session.userId })
        .where(and(eq(toothChart.organizationId, session.orgId), eq(toothChart.patientId, patientId)));
    } else {
      await db.insert(toothChart).values({
        id: randomUUID(),
        organizationId: session.orgId,
        patientId,
        toothData: JSON.stringify(parsed.data),
        updatedAt: now,
        updatedBy: session.userId,
      });
    }

    return apiOk({ success: true });
  }
);
