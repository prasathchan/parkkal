import Link from "next/link";
import { Header } from "@/components/header";
import { StatCard } from "@/components/stat-card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { formatCurrency, formatDoctorName } from "@/lib/utils";
import { cookies } from "next/headers";
import { verifyOrgToken } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/flags";
import { getDb } from "@/lib/db";
import { organizationPatients, appointments, payments, visits, patients, users } from "@/db/schema";
import { eq, and, ne, count, sum, gte, desc } from "drizzle-orm";

async function getDashboardStats(orgId: string) {
  const db = getDb();
  const now = new Date();
  const today = now.toLocaleDateString("en-CA");
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

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
    db.select({ val: count() }).from(organizationPatients).where(eq(organizationPatients.organizationId, orgId)),
    db.select({ val: count() }).from(appointments).where(and(eq(appointments.organizationId, orgId), eq(appointments.appointmentDate, today))),
    db.select({ val: count() }).from(visits).where(and(eq(visits.organizationId, orgId), eq(visits.status, "OPEN"))),
    db.select({ val: sum(payments.amount) }).from(payments)
      .innerJoin(visits, eq(payments.visitId, visits.id))
      .where(and(eq(visits.organizationId, orgId), gte(payments.paidAt, monthStart))),
    db.select({ val: sum(visits.totalAmount) }).from(visits).where(and(eq(visits.organizationId, orgId), ne(visits.status, "CANCELLED"))),
    db.select({ val: sum(visits.paidAmount) }).from(visits).where(and(eq(visits.organizationId, orgId), ne(visits.status, "CANCELLED"))),
    db.select({ val: sum(payments.amount) }).from(payments)
      .innerJoin(visits, eq(payments.visitId, visits.id))
      .where(and(eq(visits.organizationId, orgId), gte(payments.paidAt, todayStart))),
    db.select({ val: count() }).from(visits).where(and(eq(visits.organizationId, orgId), eq(visits.visitDate, today), eq(visits.visitType, "APPOINTMENT"))),
    db.select({ val: count() }).from(visits).where(and(eq(visits.organizationId, orgId), eq(visits.visitDate, today), eq(visits.visitType, "WALKIN"))),
  ]);

  return {
    totalPatients: totalPatientsRows[0]?.val ?? 0,
    todayAppointments: todayAppointmentsRows[0]?.val ?? 0,
    pendingVisits: pendingVisitsRows[0]?.val ?? 0,
    monthlyRevenue: Number(monthlyRevenueRows[0]?.val) || 0,
    todayRevenue: Number(todayRevenueRows[0]?.val) || 0,
    outstandingDues: (Number(openBilledRows[0]?.val) || 0) - (Number(openPaidRows[0]?.val) || 0),
    todayAppointmentVisits: todayApptVisitsRows[0]?.val ?? 0,
    todayWalkInVisits: todayWalkInVisitsRows[0]?.val ?? 0,
  };
}

type AppointmentRow = Awaited<ReturnType<typeof getTodayAppointments>>[number];

async function getTodayAppointments(orgId: string): Promise<Array<{
  id: string | null;
  patientId: string | null;
  doctorId: string | null;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  type: string | null;
  patientName: string | null;
  doctorName: string | null;
}>> {
  const db = getDb();
  const today = new Date().toLocaleDateString("en-CA");
  const rows = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      doctorId: appointments.doctorId,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      status: appointments.status,
      type: appointments.type,
      patientName: patients.name,
      doctorName: users.name,
    })
    .from(appointments)
    .leftJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(users, eq(appointments.doctorId, users.id))
    .where(and(eq(appointments.organizationId, orgId), eq(appointments.appointmentDate, today)))
    .orderBy(desc(appointments.createdAt));

  return rows.sort((a: (typeof rows)[number], b: (typeof rows)[number]) => a.appointmentTime.localeCompare(b.appointmentTime));
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const orgToken = cookieStore.get("pkd_org_session")?.value;
  const session = orgToken ? await verifyOrgToken(orgToken) : null;

  const [statsData, todayAppointments, showAppointmentSource] = await Promise.all([
    session ? getDashboardStats(session.orgId) : Promise.resolve(null),
    session ? getTodayAppointments(session.orgId) : Promise.resolve([] as Awaited<ReturnType<typeof getTodayAppointments>>),
    session ? isFeatureEnabled("ff_appointment_source", session.orgId) : Promise.resolve(false),
  ]);

  const stats = statsData ?? {
    totalPatients: 0,
    todayAppointments: 0,
    pendingVisits: 0,
    monthlyRevenue: 0,
    todayRevenue: 0,
    outstandingDues: 0,
    todayAppointmentVisits: 0,
    todayWalkInVisits: 0,
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Dashboard"
        breadcrumb={[{ label: "Home" }, { label: "Dashboard" }]}
        user={session ? { name: session.name, role: session.role } : undefined}
      />


      <main className="flex-1 p-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            label="Total Patients"
            value={stats.totalPatients}
            iconBg="bg-blue-100"
            icon={
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <StatCard
            label="Today's Appointments"
            value={stats.todayAppointments}
            iconBg="bg-green-100"
            icon={
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
          <StatCard
            label="Open Visits"
            value={stats.pendingVisits}
            iconBg="bg-yellow-100"
            icon={
              <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            }
          />
          <StatCard
            label="Monthly Revenue"
            value={formatCurrency(stats.monthlyRevenue)}
            iconBg="bg-purple-100"
            icon={
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Today's Revenue"
            value={formatCurrency(stats.todayRevenue)}
            iconBg="bg-green-100"
            icon={
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Outstanding Dues"
            value={formatCurrency(stats.outstandingDues)}
            iconBg="bg-red-100"
            icon={
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        {/* Visit Source Widget (feature-flagged) */}
        {showAppointmentSource && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-6 py-4">
            <h2 className="font-semibold text-slate-900 mb-3">Today&apos;s Visit Sources</h2>
            <div className="flex gap-8">
              <div className="flex items-center gap-2">
                <span className="text-xl">📅</span>
                <div>
                  <p className="text-xs text-slate-500">By Appointment</p>
                  <p className="text-lg font-bold text-slate-900">{stats.todayAppointmentVisits ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🚶</span>
                <div>
                  <p className="text-xs text-slate-500">Walk-ins</p>
                  <p className="text-lg font-bold text-slate-900">{stats.todayWalkInVisits ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Appointments + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Appointments */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Today&apos;s Appointments</h2>
              <Link
                href="/dashboard/appointments"
                className="text-xs text-blue-600 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {todayAppointments.length === 0 ? (
                <p className="px-6 py-8 text-center text-slate-400 text-sm">
                  No appointments scheduled for today
                </p>
              ) : (
                todayAppointments.map((apt) => (
                  <div key={apt.id} className="px-6 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {apt.patientName || "Patient"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {apt.appointmentTime} · {formatDoctorName(apt.doctorName)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(apt.status)}>
                        {apt.status.replace("_", " ")}
                      </Badge>
                      {(apt.status === "SCHEDULED" || apt.status === "IN_PROGRESS") && apt.patientId && (
                        <Link
                          href={`/dashboard/visits/new?patientId=${apt.patientId}&appointmentId=${apt.id}&doctorId=${apt.doctorId ?? ""}`}
                          className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-lg transition"
                        >
                          Start Visit
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Quick Actions</h2>
            </div>
            <div className="p-6 space-y-3">
              <Link
                href="/dashboard/visits/new"
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 transition group"
              >
                <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">New Visit</p>
                  <p className="text-xs text-slate-500">Start a walk-in or appointment visit</p>
                </div>
              </Link>

              <Link
                href="/dashboard/patients/new"
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition group"
              >
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">New Patient</p>
                  <p className="text-xs text-slate-500">Register a new patient</p>
                </div>
              </Link>

              <Link
                href="/dashboard/appointments/new"
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-green-50 hover:border-green-200 transition group"
              >
                <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Book Appointment</p>
                  <p className="text-xs text-slate-500">Schedule a new visit</p>
                </div>
              </Link>

              <Link
                href="/dashboard/billing"
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-yellow-50 hover:border-yellow-200 transition group"
              >
                <div className="w-9 h-9 bg-yellow-100 rounded-lg flex items-center justify-center group-hover:bg-yellow-200 transition">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Billing</p>
                  <p className="text-xs text-slate-500">View & manage invoices</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
