/**
 * GET /api/visits/[id]/complete-check
 *
 * Called when a doctor clicks "Complete Visit" to decide whether to show the
 * deferred-prompt modal. Returns the data needed to render treatment status
 * decisions and chart-change notices.
 *
 * Returns:
 *   needsAttention: boolean — true if the modal should appear
 *   treatments:     TreatmentDecision[] — one entry per linked treatment that needs a decision
 */
import { eq, and, sum } from "drizzle-orm";
import { visits, treatments, visitTreatments, visitItems, payments, toothConditionHistory } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";

type Params = { id: string };

export interface TreatmentDecision {
  id: string;
  description: string;
  procedure: string | null;
  toothNumbers: string | null;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  cost: number;
  /** Total paid across ALL visits via linked visit items */
  totalPaidViaItems: number;
  /** Amount paid via direct treatment payment records (fallback for L3 gap) */
  totalPaidViaDirect: number;
  /** Best total: max(totalPaidViaItems, totalPaidViaDirect) */
  totalPaid: number;
  /** Amount paid via visit items THIS visit only */
  paidThisVisit: number;
  /** Whether chart was manually updated for any of this treatment's teeth during this visit */
  chartChangedThisVisit: boolean;
  /** Whether a treatment_start chart entry already exists for this treatment */
  hasChartStartEntry: boolean;
  /** Suggested next status — null means no suggestion (doctor decides) */
  suggestedStatus: "IN_PROGRESS" | "COMPLETED" | null;
}

export const GET = withRoute<Params>(
  { route: "GET /api/visits/[id]/complete-check", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.VISITS_EDIT },
  async (_req, { session, db }, { id: visitId }) => {
    const [visit] = await db
      .select({ id: visits.id, patientId: visits.patientId, status: visits.status })
      .from(visits)
      .where(and(eq(visits.id, visitId), eq(visits.organizationId, session.orgId)));

    if (!visit) return apiError("Visit not found", 404);
    if (visit.status !== "OPEN") return apiError("Visit is not open", 422);

    // Load all treatments linked to this visit
    const linked = await db
      .select({
        id:           treatments.id,
        description:  treatments.description,
        procedure:    treatments.procedure,
        toothNumbers: treatments.toothNumbers,
        status:       treatments.status,
        cost:         treatments.cost,
      })
      .from(visitTreatments)
      .innerJoin(treatments, eq(visitTreatments.treatmentId, treatments.id))
      .where(and(
        eq(visitTreatments.visitId, visitId),
        eq(treatments.organizationId, session.orgId),
      ));

    if (linked.length === 0) return apiOk({ needsAttention: false, treatments: [] });

    const decisions: TreatmentDecision[] = [];

    for (const tx of linked) {
      // Paid across all visits via linked visit items (primary attribution)
      const [itemsRow] = await db
        .select({ total: sum(visitItems.amount) })
        .from(visitItems)
        .where(eq(visitItems.linkedTreatmentId, tx.id));
      const totalPaidViaItems = Number(itemsRow?.total ?? 0);

      // Paid via direct payment records (L3: fallback for general payments)
      const [paymentsRow] = await db
        .select({ total: sum(payments.amount) })
        .from(payments)
        .where(eq(payments.treatmentId, tx.id));
      const totalPaidViaDirect = Number(paymentsRow?.total ?? 0);

      const totalPaid = Math.max(totalPaidViaItems, totalPaidViaDirect);

      // Paid via visit items THIS visit only
      const [thisVisitRow] = await db
        .select({ total: sum(visitItems.amount) })
        .from(visitItems)
        .where(and(
          eq(visitItems.visitId, visitId),
          eq(visitItems.linkedTreatmentId, tx.id),
        ));
      const paidThisVisit = Number(thisVisitRow?.total ?? 0);

      // Did chart change for any of this treatment's teeth during this visit?
      let chartChangedThisVisit = false;
      let hasChartStartEntry = false;

      if (tx.toothNumbers) {
        const teeth = tx.toothNumbers.split(",").map((s: string) => s.trim()).filter(Boolean);

        for (const tooth of teeth) {
          const rows = await db
            .select({ id: toothConditionHistory.id, source: toothConditionHistory.source })
            .from(toothConditionHistory)
            .where(and(
              eq(toothConditionHistory.organizationId, session.orgId),
              eq(toothConditionHistory.patientId, visit.patientId),
              eq(toothConditionHistory.toothNumber, tooth),
              eq(toothConditionHistory.visitId, visitId),
            ))
            .limit(5);

          if (rows.some((r: { id: string; source: string | null }) => r.source === "manual")) chartChangedThisVisit = true;
          if (rows.some((r: { id: string; source: string | null }) => r.source === "treatment_start")) hasChartStartEntry = true;
        }
      }

      // Suggest next status
      let suggestedStatus: "IN_PROGRESS" | "COMPLETED" | null = null;
      if (tx.status === "PLANNED" && paidThisVisit > 0) {
        suggestedStatus = tx.cost > 0 && totalPaid >= tx.cost ? "COMPLETED" : "IN_PROGRESS";
      } else if (tx.status === "IN_PROGRESS" && tx.cost > 0 && totalPaid >= tx.cost) {
        suggestedStatus = "COMPLETED";
      }

      // Only include in the modal if a decision is warranted
      const needsDecision =
        (tx.status === "PLANNED" && paidThisVisit > 0) ||
        (tx.status === "IN_PROGRESS" && tx.cost > 0 && totalPaid >= tx.cost) ||
        (tx.status === "IN_PROGRESS" && chartChangedThisVisit && !hasChartStartEntry);

      if (needsDecision) {
        decisions.push({
          id:                  tx.id,
          description:         tx.description,
          procedure:           tx.procedure ?? null,
          toothNumbers:        tx.toothNumbers ?? null,
          status:              tx.status as "PLANNED" | "IN_PROGRESS" | "COMPLETED",
          cost:                tx.cost,
          totalPaidViaItems,
          totalPaidViaDirect,
          totalPaid,
          paidThisVisit,
          chartChangedThisVisit,
          hasChartStartEntry,
          suggestedStatus,
        });
      }
    }

    return apiOk({ needsAttention: decisions.length > 0, treatments: decisions });
  }
);
