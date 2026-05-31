import { NextRequest, NextResponse } from "next/server";
import { eq, and, ne, count, sum, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizationPatients, appointments, payments, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const orgId = session.orgId;

  const today = new Date().toISOString().split("T")[0];
  const todayStart = new Date(today).getTime();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  const [
    totalPatientsRows,
    todayAppointmentsRows,
    pendingVisitsRows,
    monthlyRevenueRows,
    openBilledRows,
    openPaidRows,
  ] = await Promise.all([
    db.select({ val: count() }).from(organizationPatients).where(eq(organizationPatients.organizationId, orgId)),
    db
      .select({ val: count() })
      .from(appointments)
      .where(and(eq(appointments.organizationId, orgId), eq(appointments.appointmentDate, today))),
    db
      .select({ val: count() })
      .from(visits)
      .where(and(eq(visits.organizationId, orgId), eq(visits.status, "OPEN"))),
    // Monthly revenue: sum of payments for this org's visits this month
    db
      .select({ val: sum(payments.amount) })
      .from(payments)
      .innerJoin(visits, eq(payments.visitId, visits.id))
      .where(and(eq(visits.organizationId, orgId), gte(payments.paidAt, monthStart))),
    db
      .select({ val: sum(visits.totalAmount) })
      .from(visits)
      .where(and(eq(visits.organizationId, orgId), ne(visits.status, "CANCELLED"))),
    db
      .select({ val: sum(visits.paidAmount) })
      .from(visits)
      .where(and(eq(visits.organizationId, orgId), ne(visits.status, "CANCELLED"))),
  ]);

  // Today's revenue: sum of payments recorded today for this org
  const todayRevenueRows = await db
    .select({ val: sum(payments.amount) })
    .from(payments)
    .innerJoin(visits, eq(payments.visitId, visits.id))
    .where(and(eq(visits.organizationId, orgId), gte(payments.paidAt, todayStart)));

  return NextResponse.json({
    totalPatients: totalPatientsRows[0]?.val ?? 0,
    todayAppointments: todayAppointmentsRows[0]?.val ?? 0,
    pendingVisits: pendingVisitsRows[0]?.val ?? 0,
    monthlyRevenue: Number(monthlyRevenueRows[0]?.val) || 0,
    todayRevenue: Number(todayRevenueRows[0]?.val) || 0,
    outstandingDues: (Number(openBilledRows[0]?.val) || 0) - (Number(openPaidRows[0]?.val) || 0),
    // source_type column not yet added — returns 0 until Phase 2
    todayAppointmentVisits: 0,
    todayWalkInVisits: 0,
  });
}
