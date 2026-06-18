/**
 * GET /api/dashboard/stats?locationId=
 *
 * Returns today's metrics and schedule, scoped to a branch when locationId is
 * supplied. Called by the client-side DashboardClientSection so the stat strip
 * and today's schedule react to the header branch selector in real time.
 */
import { eq, and, count, sum, gte, desc } from "drizzle-orm";
import {
  organizationPatients, appointments, payments, visits, patients, users,
} from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";

export const GET = withRoute(
  { route: "GET /api/dashboard/stats", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.VISITS_VIEW },
  async (req, { session, db }) => {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId") ?? null;

    const orgId      = session.orgId;
    const now        = new Date();
    const today      = now.toLocaleDateString("en-CA");
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const visitBase = locationId
      ? and(eq(visits.organizationId, orgId), eq(visits.locationId, locationId))
      : eq(visits.organizationId, orgId);

    const apptBase = locationId
      ? and(eq(appointments.organizationId, orgId), eq(appointments.locationId, locationId))
      : eq(appointments.organizationId, orgId);

    const [
      totalPatientsRows,
      todayAppointmentsRows,
      pendingVisitsRows,
      monthlyRevenueRows,
      openBilledRows,
      openPaidRows,
      todayRevenueRows,
      todayApptVisitsRows,
      todayWalkInVisitsRows,
    ] = await Promise.all([
      db.select({ val: count() }).from(organizationPatients)
        .where(eq(organizationPatients.organizationId, orgId)),
      db.select({ val: count() }).from(appointments)
        .where(and(apptBase, eq(appointments.appointmentDate, today))),
      db.select({ val: count() }).from(visits)
        .where(and(visitBase, eq(visits.status, "OPEN"))),
      db.select({ val: sum(payments.amount) }).from(payments)
        .innerJoin(visits, eq(payments.visitId, visits.id))
        .where(and(visitBase, gte(payments.paidAt, monthStart))),
      db.select({ val: sum(visits.totalAmount) }).from(visits)
        .where(and(visitBase, eq(visits.status, "OPEN"))),
      db.select({ val: sum(visits.paidAmount) }).from(visits)
        .where(and(visitBase, eq(visits.status, "OPEN"))),
      db.select({ val: sum(payments.amount) }).from(payments)
        .innerJoin(visits, eq(payments.visitId, visits.id))
        .where(and(visitBase, gte(payments.paidAt, todayStart))),
      db.select({ val: count() }).from(visits)
        .where(and(visitBase, eq(visits.visitDate, today), eq(visits.visitType, "APPOINTMENT"))),
      db.select({ val: count() }).from(visits)
        .where(and(visitBase, eq(visits.visitDate, today), eq(visits.visitType, "WALKIN"))),
    ]);

    const scheduleRows = await db
      .select({
        id:              appointments.id,
        patientId:       appointments.patientId,
        doctorId:        appointments.doctorId,
        appointmentDate: appointments.appointmentDate,
        appointmentTime: appointments.appointmentTime,
        status:          appointments.status,
        type:            appointments.type,
        patientName:     patients.name,
        doctorName:      users.name,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(users,    eq(appointments.doctorId, users.id))
      .where(and(apptBase, eq(appointments.appointmentDate, today)))
      .orderBy(desc(appointments.createdAt));

    type Row = typeof scheduleRows[number];
    const todaySchedule = scheduleRows
      .sort((a: Row, b: Row) => a.appointmentTime.localeCompare(b.appointmentTime));

    return apiOk({
      stats: {
        totalPatients:          totalPatientsRows[0]?.val ?? 0,
        todayAppointments:      todayAppointmentsRows[0]?.val ?? 0,
        pendingVisits:          pendingVisitsRows[0]?.val ?? 0,
        monthlyRevenue:         Number(monthlyRevenueRows[0]?.val) || 0,
        todayRevenue:           Number(todayRevenueRows[0]?.val) || 0,
        outstandingDues:        (Number(openBilledRows[0]?.val) || 0) - (Number(openPaidRows[0]?.val) || 0),
        todayAppointmentVisits: todayApptVisitsRows[0]?.val ?? 0,
        todayWalkInVisits:      todayWalkInVisitsRows[0]?.val ?? 0,
      },
      todaySchedule,
    });
  }
);
