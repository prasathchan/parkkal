import { eq, and } from "drizzle-orm";
import { toothChart, toothChartHistory, toothConditionHistory, organizationPatients } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { runCascade } from "@/lib/db";
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

    const [link] = await db.select({ id: organizationPatients.id })
      .from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, patientId)))
      .limit(1);
    if (!link) return apiError("Patient not found", 404);

    const body = await req.json() as Record<string, unknown>;
    const parsed = toothDataSchema.safeParse(body.toothData ?? {});
    if (!parsed.success) return apiError("Invalid tooth data", 400);

    const visitId    = typeof body.visitId    === "string" ? body.visitId    : null;
    const treatmentId = typeof body.treatmentId === "string" ? body.treatmentId : null;
    const source = (["manual", "treatment_start", "treatment_complete"] as const).includes(
      body.source as "manual" | "treatment_start" | "treatment_complete"
    ) ? (body.source as "manual" | "treatment_start" | "treatment_complete") : "manual";

    const now = Date.now();
    const newData = parsed.data;

    // Load existing chart to compute diff
    const [existing] = await db.select()
      .from(toothChart)
      .where(and(eq(toothChart.organizationId, session.orgId), eq(toothChart.patientId, patientId)))
      .limit(1);

    const oldData = existing ? (JSON.parse(existing.toothData) as Record<string, { condition: string }>) : {};

    // Compute which FDI teeth changed condition
    const allTeeth = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    const changedTeeth: string[] = [];
    for (const tooth of allTeeth) {
      const oldCond = oldData[tooth]?.condition ?? "HEALTHY";
      const newCond = newData[tooth]?.condition ?? "HEALTHY";
      if (oldCond !== newCond) changedTeeth.push(tooth);
    }

    // Skip history when nothing changed and a chart already exists.
    if (changedTeeth.length === 0 && existing) {
      return apiOk({ success: true, changedTeeth: [] });
    }

    // Both writes must succeed together. D1 does not support db.transaction()
    // with async callbacks — use runCascade() (D1 batch) instead.
    const chartWrite = existing
      ? db.update(toothChart)
          .set({ toothData: JSON.stringify(newData), updatedAt: now, updatedBy: session.userId })
          .where(and(eq(toothChart.organizationId, session.orgId), eq(toothChart.patientId, patientId)))
      : db.insert(toothChart).values({
          id: randomUUID(),
          organizationId: session.orgId,
          patientId,
          toothData: JSON.stringify(newData),
          updatedAt: now,
          updatedBy: session.userId,
        });

    const historyWrite = db.insert(toothChartHistory).values({
      id:           randomUUID(),
      organizationId: session.orgId,
      patientId,
      visitId,
      toothData:    JSON.stringify(newData),
      changedTeeth: JSON.stringify(changedTeeth),
      source,
      recordedBy:   session.userId,
      recordedAt:   now,
    });

    await runCascade(db, [chartWrite, historyWrite]);

    // Write per-tooth condition history entries for each changed tooth.
    // These power the patient-facing tooth timeline and the Chart→Treatment deferred prompt.
    for (const tooth of changedTeeth) {
      await db.insert(toothConditionHistory).values({
        id:                randomUUID(),
        organizationId:    session.orgId,
        patientId,
        toothNumber:       tooth,
        previousCondition: oldData[tooth]?.condition ?? null,
        newCondition:      newData[tooth]?.condition ?? "HEALTHY",
        visitId,
        treatmentId,
        source,
        recordedBy:        session.userId,
        recordedAt:        now,
      });
    }

    return apiOk({ success: true, changedTeeth });
  }
);
