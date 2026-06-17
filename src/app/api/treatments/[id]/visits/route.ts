import { eq, and, sum } from "drizzle-orm";
import { treatments, visitTreatments, visits, users, visitItems, patients } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";

// ── GET /api/treatments/[id]/visits ──────────────────────────────────────────
// Returns the full visit history for a treatment plan and a financial summary.
//
// Financial fields:
//   treatmentCost          — planned fee from treatments.cost
//   totalPaid              — sum of visitItems.amount WHERE linkedTreatmentId = id
//                            (amount charged to this treatment across all visits;
//                             since payment is collected at end of visit, charged ≈ paid)
//   outstanding            — treatmentCost − totalPaid (not yet charged)
//   paidPercent            — 0–100 integer for progress bar rendering
//
// Per-visit fields (on each visit row):
//   treatmentBilledAmount  — sum of visitItems.amount for THIS treatment in THAT visit
//                            (accurate even when a visit covers multiple treatments)
//   visitPaidAmount        — total payment recorded for the visit (all treatments)
export const GET = withRoute<{ id: string }>(
  { route: "GET /api/treatments/[id]/visits", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.TREATMENTS_VIEW },
  async (_req, { session, db }, { id }) => {
    const [treatment] = await db
      .select({
        id: treatments.id,
        description: treatments.description,
        procedure: treatments.procedure,
        toothNumbers: treatments.toothNumbers,
        cost: treatments.cost,
        status: treatments.status,
        patientId: treatments.patientId,
        doctorId: treatments.doctorId,
        consentStatus: treatments.consentStatus,
        consentDocumentUrl: treatments.consentDocumentUrl,
        consentDocumentName: treatments.consentDocumentName,
        consentNotes: treatments.consentNotes,
        emergencyReason: treatments.emergencyReason,
        plannedSessions: treatments.plannedSessions,
        createdAt: treatments.createdAt,
        patientName: patients.name,
        patientCode: patients.patientCode,
        doctorName: users.name,
      })
      .from(treatments)
      .leftJoin(patients, eq(treatments.patientId, patients.id))
      .leftJoin(users, eq(treatments.doctorId, users.id))
      .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

    if (!treatment) return apiError("Treatment plan not found", 404);

    // Visit history — ordered by date ascending
    const visitRows = await db
      .select({
        visitId: visitTreatments.visitId,
        linkNotes: visitTreatments.notes,
        visitCode: visits.visitCode,
        visitDate: visits.visitDate,
        visitStatus: visits.status,
        visitTotalAmount: visits.totalAmount,
        visitPaidAmount: visits.paidAmount,
        doctorName: users.name,
      })
      .from(visitTreatments)
      .innerJoin(visits, and(
        eq(visitTreatments.visitId, visits.id),
        eq(visits.organizationId, session.orgId)
      ))
      .leftJoin(users, eq(visits.doctorId, users.id))
      .where(eq(visitTreatments.treatmentId, id))
      .orderBy(visits.visitDate);

    // Per-visit treatment billing — how much of THIS treatment was charged in EACH visit.
    // A single visit may include items for multiple treatments, so we must group by visitId
    // rather than relying on visit.totalAmount (which covers all treatments in that visit).
    const treatmentItemsByVisit = await db
      .select({ visitId: visitItems.visitId, total: sum(visitItems.amount) })
      .from(visitItems)
      .where(eq(visitItems.linkedTreatmentId, id))
      .groupBy(visitItems.visitId);

    const billedByVisit = new Map<string, number>();
    for (const row of treatmentItemsByVisit) {
      if (row.visitId) billedByVisit.set(row.visitId, Number(row.total ?? 0));
    }

    // Overall financial summary — totalPaid = sum across all visitItem groupings
    const totalPaid = [...billedByVisit.values()].reduce((acc, v) => acc + v, 0);
    const outstanding = Math.max(0, treatment.cost - totalPaid);
    const paidPercent = treatment.cost > 0
      ? Math.min(100, Math.round((totalPaid / treatment.cost) * 100))
      : 100;

    return apiOk({
      treatment,
      visits: visitRows.map((v: typeof visitRows[number]) => ({
        ...v,
        // Amount charged to THIS treatment specifically in this visit
        treatmentBilledAmount: billedByVisit.get(v.visitId) ?? 0,
      })),
      summary: {
        treatmentCost: treatment.cost,
        totalPaid,
        outstanding,
        paidPercent,
        visitCount: visitRows.length,
      },
    });
  }
);
