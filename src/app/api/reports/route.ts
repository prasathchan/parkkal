/**
 * GET /api/reports
 *
 * Returns aggregated business metrics for the org's reporting dashboard.
 * Requires REPORTS_VIEW permission (ADMIN/MANAGER by default).
 *
 * Query params:
 *   period — '7d' | '30d' | '90d' | '365d'  (default '30d')
 *   from   — YYYY-MM-DD  (custom range start; overrides period when both from+to are set)
 *   to     — YYYY-MM-DD  (custom range end, inclusive)
 *
 * Response shape:
 *   summary       — total revenue, total paid, outstanding, patient count, visit count
 *   revenueByDay  — [{ date: "YYYY-MM-DD", billed: number, collected: number }]
 *   newPatients   — [{ date: "YYYY-MM-DD", count: number }] (by registration date)
 *   visitsByStatus— { OPEN, COMPLETED, CANCELLED }
 *   apptByStatus  — { SCHEDULED, COMPLETED, CANCELLED, NO_SHOW, IN_PROGRESS }
 *   topProcedures — [{ procedure: string, count: number, revenue: number }] top 10
 *   treatmentByStatus — { PLANNED, IN_PROGRESS, COMPLETED }
 */
import { eq, and, gte, lte, sum, count, ne } from "drizzle-orm";
import { visits, payments, organizationPatients, appointments, treatments, users } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";

// Epoch ms for midnight (local time, YYYY-MM-DD)
function dayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// ISO date string "YYYY-MM-DD" for a given ms offset
function toDateStr(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA"); // "YYYY-MM-DD"
}

export const GET = withRoute(
  { route: "GET /api/reports", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.REPORTS_VIEW },
  async (req, { session, db }) => {
    const { searchParams } = new URL(req.url);
    const periodParam = searchParams.get("period") ?? "30d";
    const fromParam   = searchParams.get("from");  // YYYY-MM-DD
    const toParam     = searchParams.get("to");    // YYYY-MM-DD

    const orgId = session.orgId;
    const now   = Date.now();

    let start: number;
    let end: number;
    let days: number;
    let label: string;

    if (fromParam && toParam) {
      // Custom date range
      start = dayStart(new Date(fromParam));
      end   = dayStart(new Date(toParam)) + 86_400_000; // inclusive of toParam day
      days  = Math.max(1, Math.round((end - start) / 86_400_000));
      label = `${fromParam} – ${toParam}`;
    } else {
      days  = periodParam === "365d" ? 365 : periodParam === "90d" ? 90 : periodParam === "7d" ? 7 : 30;
      start = dayStart(new Date(now - (days - 1) * 86_400_000));
      end   = dayStart(new Date(now)) + 86_400_000;
      label = periodParam;
    }

    const inPeriod     = and(eq(visits.organizationId, orgId), gte(visits.createdAt, start), lte(visits.createdAt, end));
    const inPeriodNoCx = and(inPeriod, ne(visits.status, "CANCELLED"));

    // ── 1. Summary totals ─────────────────────────────────────────────────────
    const [totalPatients, periodVisits, totalBilledRows, totalCollectedRows, outstandingVisits] = await Promise.all([
      db.select({ val: count() }).from(organizationPatients)
        .where(eq(organizationPatients.organizationId, orgId)),

      db.select({ val: count() }).from(visits)
        .where(inPeriodNoCx),

      db.select({ val: sum(visits.totalAmount) }).from(visits)
        .where(inPeriodNoCx),

      db.select({ val: sum(payments.amount) }).from(payments)
        .innerJoin(visits, eq(payments.visitId, visits.id))
        .where(and(eq(visits.organizationId, orgId), gte(payments.paidAt, start), lte(payments.paidAt, end))),

      db.select({ val: sum(visits.totalAmount) }).from(visits)
        .where(and(eq(visits.organizationId, orgId), eq(visits.status, "OPEN"))),
    ]);

    const totalBilled    = Number(totalBilledRows[0]?.val)    || 0;
    const totalCollected = Number(totalCollectedRows[0]?.val) || 0;
    const outstanding    = Number(outstandingVisits[0]?.val)  || 0;

    // ── 2. Revenue per day (billed = totalAmount, collected = payments) ───────
    // Build a date map for the period, then fill from DB rows
    const dayMap: Map<string, { billed: number; collected: number }> = new Map();
    for (let d = 0; d < days; d++) {
      const ds = toDateStr(start + d * 86_400_000);
      dayMap.set(ds, { billed: 0, collected: 0 });
    }

    const [visitsByDay, paymentsByDay] = await Promise.all([
      db.select({ date: visits.visitDate, billed: sum(visits.totalAmount) })
        .from(visits)
        .where(inPeriodNoCx)
        .groupBy(visits.visitDate),

      db.select({ date: visits.visitDate, collected: sum(payments.amount) })
        .from(payments)
        .innerJoin(visits, eq(payments.visitId, visits.id))
        .where(and(eq(visits.organizationId, orgId), gte(payments.paidAt, start), lte(payments.paidAt, end)))
        .groupBy(visits.visitDate),
    ]);

    for (const r of visitsByDay) {
      if (r.date && dayMap.has(r.date)) dayMap.get(r.date)!.billed = Number(r.billed) || 0;
    }
    for (const r of paymentsByDay) {
      if (r.date && dayMap.has(r.date)) dayMap.get(r.date)!.collected = Number(r.collected) || 0;
    }

    const revenueByDay = [...dayMap.entries()].map(([date, v]) => ({ date, ...v }));

    // ── 3. New patient registrations per day ──────────────────────────────────
    const patientRows = await db
      .select({ date: organizationPatients.registeredAt, val: count() })
      .from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, orgId), gte(organizationPatients.registeredAt, start), lte(organizationPatients.registeredAt, end)))
      .groupBy(organizationPatients.registeredAt);

    // registeredAt is a Unix ms timestamp — group by date string
    const newPatientMap = new Map<string, number>();
    for (const r of patientRows) {
      const ds = toDateStr(Number(r.date));
      newPatientMap.set(ds, (newPatientMap.get(ds) ?? 0) + Number(r.val));
    }
    const newPatients = [...dayMap.keys()].map((date) => ({
      date,
      count: newPatientMap.get(date) ?? 0,
    }));

    // ── 4. Visit status distribution ─────────────────────────────────────────
    const visitStatusRows = await db
      .select({ status: visits.status, val: count() })
      .from(visits)
      .where(inPeriod)
      .groupBy(visits.status);

    const visitsByStatus: Record<string, number> = {};
    for (const r of visitStatusRows) visitsByStatus[r.status] = Number(r.val);

    // ── 5. Appointment status distribution ───────────────────────────────────
    const apptStatusRows = await db
      .select({ status: appointments.status, val: count() })
      .from(appointments)
      .where(and(eq(appointments.organizationId, orgId), gte(appointments.createdAt, start), lte(appointments.createdAt, end)))
      .groupBy(appointments.status);

    const apptByStatus: Record<string, number> = {};
    for (const r of apptStatusRows) apptByStatus[r.status] = Number(r.val);

    // ── 6. Top 10 procedures by count + revenue ───────────────────────────────
    const procedureRows = await db
      .select({ description: treatments.description, procedure: treatments.procedure, cnt: count(), rev: sum(treatments.cost) })
      .from(treatments)
      .where(and(eq(treatments.organizationId, orgId), gte(treatments.createdAt, start), lte(treatments.createdAt, end)))
      .groupBy(treatments.description);

    const topProcedures = procedureRows
      .map((r: typeof procedureRows[number]) => ({
        procedure: r.description || r.procedure || "(unspecified)",
        count:   Number(r.cnt),
        revenue: Number(r.rev) || 0,
      }))
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
      .slice(0, 10);

    // ── 7. Treatment status distribution ─────────────────────────────────────
    const txStatusRows = await db
      .select({ status: treatments.status, val: count() })
      .from(treatments)
      .where(and(eq(treatments.organizationId, orgId), gte(treatments.createdAt, start), lte(treatments.createdAt, end)))
      .groupBy(treatments.status);

    const treatmentByStatus: Record<string, number> = {};
    for (const r of txStatusRows) treatmentByStatus[r.status] = Number(r.val);

    // ── 8. Per-doctor breakdown ───────────────────────────────────────────────
    const doctorVisitRows = await db
      .select({
        doctorId:   visits.doctorId,
        doctorName: users.name,
        visits:     count(),
        billed:     sum(visits.totalAmount),
      })
      .from(visits)
      .leftJoin(users, eq(visits.doctorId, users.id))
      .where(inPeriodNoCx)
      .groupBy(visits.doctorId, users.name);

    // Collect per-doctor payments
    const doctorPaymentRows = await db
      .select({ doctorId: visits.doctorId, collected: sum(payments.amount) })
      .from(payments)
      .innerJoin(visits, eq(payments.visitId, visits.id))
      .where(and(eq(visits.organizationId, orgId), gte(payments.paidAt, start), lte(payments.paidAt, end)))
      .groupBy(visits.doctorId);

    const doctorCollectedMap = new Map<string, number>();
    for (const r of doctorPaymentRows) {
      if (r.doctorId) doctorCollectedMap.set(r.doctorId, Number(r.collected) || 0);
    }

    const doctorBreakdown = doctorVisitRows
      .map((r: typeof doctorVisitRows[number]) => ({
        doctorId:   r.doctorId ?? "",
        doctorName: r.doctorName ?? "Unknown",
        visits:     Number(r.visits),
        billed:     Number(r.billed)  || 0,
        collected:  doctorCollectedMap.get(r.doctorId ?? "") ?? 0,
      }))
      .sort((a: { visits: number }, b: { visits: number }) => b.visits - a.visits);

    return apiOk({
      period: { days, startMs: start, endMs: end, label },
      summary: {
        totalPatients:   totalPatients[0]?.val ?? 0,
        periodVisits:    periodVisits[0]?.val  ?? 0,
        totalBilled,
        totalCollected,
        collectionRate:  totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100,
        outstanding,
      },
      revenueByDay,
      newPatients,
      visitsByStatus,
      apptByStatus,
      topProcedures,
      treatmentByStatus,
      doctorBreakdown,
    });
  }
);
