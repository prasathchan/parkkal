import { eq, and, ne, count, sum, gte } from "drizzle-orm";
import { organizationPatients, appointments, payments, visits } from "@/db/schema";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";

/** GET /api/dashboard/stats — summary counts + revenue for the org dashboard */
export const GET = withRoute(
  { route: "GET /api/dashboard/stats", rateLimit: RATE_LIMITS.READ },
  async (_req, { session, db }) => {
    const orgId = session.orgId;
    const now = new Date();
    const today = now.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const [
      totalPatientsRows,
      todayAppointmentsRows,
      pendingVisitsRows,
      monthlyRevenueRows,
      openBilledRows,
      openPaidRows,
    ] = await Promise.all([
      db.select({ val: count() }).from(organizationPatients).where(eq(organizationPatients.organizationId, orgId)),
      db.select({ val: count() }).from(appointments)
        .where(and(eq(appointments.organizationId, orgId), eq(appointments.appointmentDate, today))),
      db.select({ val: count() }).from(visits)
        .where(and(eq(visits.organizationId, orgId), eq(visits.status, "OPEN"))),
      // Monthly revenue: sum of payments for this org's visits this month
      db.select({ val: sum(payments.amount) }).from(payments)
        .innerJoin(visits, eq(payments.visitId, visits.id))
        .where(and(eq(visits.organizationId, orgId), gte(payments.paidAt, monthStart))),
      db.select({ val: sum(visits.totalAmount) }).from(visits)
        .where(and(eq(visits.organizationId, orgId), ne(visits.status, "CANCELLED"))),
      db.select({ val: sum(visits.paidAmount) }).from(visits)
        .where(and(eq(visits.organizationId, orgId), ne(visits.status, "CANCELLED"))),
    ]);

    const [todayRevenueRows, todayApptVisitsRows, todayWalkInVisitsRows] = await Promise.all([
      db.select({ val: sum(payments.amount) }).from(payments)
        .innerJoin(visits, eq(payments.visitId, visits.id))
        .where(and(eq(visits.organizationId, orgId), gte(payments.paidAt, todayStart))),
      db.select({ val: count() }).from(visits)
        .where(and(eq(visits.organizationId, orgId), eq(visits.visitDate, today), eq(visits.visitType, "APPOINTMENT"))),
      db.select({ val: count() }).from(visits)
        .where(and(eq(visits.organizationId, orgId), eq(visits.visitDate, today), eq(visits.visitType, "WALKIN"))),
    ]);

    return apiOk({
      totalPatients: totalPatientsRows[0]?.val ?? 0,
      todayAppointments: todayAppointmentsRows[0]?.val ?? 0,
      pendingVisits: pendingVisitsRows[0]?.val ?? 0,
      monthlyRevenue: Number(monthlyRevenueRows[0]?.val) || 0,
      todayRevenue: Number(todayRevenueRows[0]?.val) || 0,
      outstandingDues: (Number(openBilledRows[0]?.val) || 0) - (Number(openPaidRows[0]?.val) || 0),
      todayAppointmentVisits: todayApptVisitsRows[0]?.val ?? 0,
      todayWalkInVisits: todayWalkInVisitsRows[0]?.val ?? 0,
    });
  }
);
