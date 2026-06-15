import Link from "next/link";
import { Header } from "@/components/header";
import { StatCard } from "@/components/stat-card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { formatCurrency, formatDoctorName } from "@/lib/utils";
import { cookies } from "next/headers";
import { verifyOrgToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { organizationPatients, appointments, payments, visits, patients, users, organizations, organizationMembers } from "@/db/schema";
import { eq, and, count, sum, gte, desc } from "drizzle-orm";
import { OnboardingChecklist, type OnboardingStep } from "@/components/onboarding-checklist";
import type { SystemRole } from "@/types";

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
    db.select({ val: sum(visits.totalAmount) }).from(visits).where(and(eq(visits.organizationId, orgId), eq(visits.status, "OPEN"))),
    db.select({ val: sum(visits.paidAmount) }).from(visits).where(and(eq(visits.organizationId, orgId), eq(visits.status, "OPEN"))),
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

  type Row = typeof rows[number];
  return rows.sort((a: Row, b: Row) => a.appointmentTime.localeCompare(b.appointmentTime));
}

async function getOnboardingState(orgId: string) {
  const db = getDb();
  const [orgRows, memberCountRows, patientCountRows, apptCountRows] = await Promise.all([
    db.select({ phone: organizations.phone, address: organizations.address, logoUrl: organizations.logoUrl, onboardingDismissedAt: organizations.onboardingDismissedAt }).from(organizations).where(eq(organizations.id, orgId)).limit(1),
    db.select({ val: count() }).from(organizationMembers).where(eq(organizationMembers.organizationId, orgId)),
    db.select({ val: count() }).from(organizationPatients).where(eq(organizationPatients.organizationId, orgId)),
    db.select({ val: count() }).from(appointments).where(eq(appointments.organizationId, orgId)),
  ]);
  const org = orgRows[0];
  return {
    dismissed: !!org?.onboardingDismissedAt,
    profileDone: !!(org?.phone && org?.address),
    teamDone: (memberCountRows[0]?.val ?? 0) > 1,
    patientDone: (patientCountRows[0]?.val ?? 0) > 0,
    appointmentDone: (apptCountRows[0]?.val ?? 0) > 0,
    logoDone: !!org?.logoUrl,
  };
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const orgToken = cookieStore.get("pkd_org_session")?.value;
  const session = orgToken ? await verifyOrgToken(orgToken) : null;

  const [statsData, todayAppointments, onboarding] = await Promise.all([
    session ? getDashboardStats(session.orgId) : Promise.resolve(null),
    session ? getTodayAppointments(session.orgId) : Promise.resolve([] as Awaited<ReturnType<typeof getTodayAppointments>>),
    session ? getOnboardingState(session.orgId) : Promise.resolve(null),
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

  // Derive doctor availability rail from today's appointments
  const doctorMap = new Map<string, {
    name: string;
    apts: typeof todayAppointments;
  }>();
  for (const apt of todayAppointments) {
    const key = apt.doctorId ?? "__unknown__";
    if (!doctorMap.has(key)) {
      doctorMap.set(key, { name: apt.doctorName ?? "Doctor", apts: [] });
    }
    doctorMap.get(key)!.apts.push(apt);
  }
  const doctorRail = Array.from(doctorMap.values()).map(({ name, apts }) => {
    const inChair = apts.find(a => a.status === "IN_PROGRESS");
    const nextScheduled = apts.find(a => a.status === "SCHEDULED");
    const allDone = apts.every(a => a.status === "COMPLETED" || a.status === "CANCELLED");
    return {
      name,
      status: inChair ? "In chair" : allDone ? "Done" : "Free",
      currentPatient: inChair?.patientName ?? null,
      nextTime: !inChair && nextScheduled ? formatTime(nextScheduled.appointmentTime) : null,
      total: apts.filter(a => a.status !== "CANCELLED").length,
      done: apts.filter(a => a.status === "COMPLETED").length,
    };
  });

  const todayDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Dashboard"
        breadcrumb={[{ label: "Home" }, { label: "Dashboard" }]}
        user={session ? { name: session.name, role: session.role } : undefined}
      />

      <main id="main-content" className="flex-1 p-6 space-y-6">

        {/* Onboarding checklist */}
        {onboarding && session && (() => {
          const steps: OnboardingStep[] = [
            { id: "profile", label: "Set up your clinic profile", description: "Name, address, and phone — appears on invoices and notifications", href: "/dashboard/settings", done: onboarding.profileDone, adminOnly: true },
            { id: "team", label: "Invite your team", description: "Add doctors, receptionists, or assistants", href: "/dashboard/staff", done: onboarding.teamDone, adminOnly: true },
            { id: "patient", label: "Add your first patient", description: "Patient records, contact details, and medical history", href: "/dashboard/patients/new", done: onboarding.patientDone, adminOnly: false },
            { id: "appointment", label: "Book an appointment", description: "Schedule the first visit and send an automated reminder", href: "/dashboard/appointments/new", done: onboarding.appointmentDone, adminOnly: false },
            { id: "logo", label: "Upload your clinic logo", description: "Appears on invoices and consent forms", href: "/dashboard/settings?tab=appearance", done: onboarding.logoDone, adminOnly: true },
          ];
          return (
            <OnboardingChecklist
              steps={steps}
              role={session.role as SystemRole}
              dismissed={onboarding.dismissed}
              canDismiss={session.role === "ADMIN"}
            />
          );
        })()}

        {/* ── Zone A — Today's schedule hero ─────────────────────────────── */}
        <section aria-labelledby="zone-a-heading">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] rounded-pk-lg border border-pk-border shadow-pk-e1 overflow-hidden">

            {/* Left 72%: time-ordered schedule */}
            <div className="bg-pk-surface">
              <div className="px-6 py-4 border-b border-pk-border flex items-center justify-between">
                <div>
                  <h2 id="zone-a-heading" className="font-semibold text-pk-text">Today&apos;s Schedule</h2>
                  <p className="text-xs text-pk-text-muted mt-0.5">{todayDate}</p>
                </div>
                <Link href="/dashboard/appointments" className="text-xs text-pk-teal-600 hover:underline">
                  View all
                </Link>
              </div>

              <div className="divide-y divide-pk-border">
                {todayAppointments.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <p className="text-pk-text-muted text-sm mb-3">No appointments scheduled for today</p>
                    <Link
                      href="/dashboard/appointments/new"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-pk-teal-600 hover:text-pk-teal-700"
                    >
                      Book an appointment →
                    </Link>
                  </div>
                ) : (
                  todayAppointments.map((apt) => {
                    const isInChair = apt.status === "IN_PROGRESS";
                    const isDone = apt.status === "COMPLETED" || apt.status === "CANCELLED";
                    return (
                      <div
                        key={apt.id}
                        className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-pk-surface-raised"
                        style={{
                          borderLeft: isInChair ? "3px solid var(--pk-accent)" : "3px solid transparent",
                          opacity: isDone ? 0.6 : 1,
                        }}
                      >
                        {/* Time */}
                        <span className="w-16 flex-shrink-0 text-xs font-medium text-pk-text-secondary tabular-nums">
                          {formatTime(apt.appointmentTime)}
                        </span>

                        {/* Patient + doctor */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-pk-text truncate">
                            {apt.patientName || "Patient"}
                          </p>
                          <p className="text-xs text-pk-text-muted">{formatDoctorName(apt.doctorName)}</p>
                        </div>

                        {/* Status + action */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant={getStatusBadgeVariant(apt.status)}>
                            {apt.status.replace("_", " ")}
                          </Badge>
                          {(apt.status === "SCHEDULED" || apt.status === "IN_PROGRESS") && apt.patientId && (
                            <Link
                              href={`/dashboard/visits/new?patientId=${apt.patientId}&appointmentId=${apt.id}&doctorId=${apt.doctorId ?? ""}`}
                              className="text-xs font-medium text-white bg-pk-teal-600 hover:bg-pk-teal-700 px-2.5 py-1 rounded-pk-xs transition"
                            >
                              {isInChair ? "View Visit" : "Start Visit"}
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right 28%: doctor availability rail */}
            <div className="bg-pk-surface-raised border-t lg:border-t-0 lg:border-l border-pk-border">
              <div className="px-4 py-4 border-b border-pk-border">
                <h3 className="text-sm font-semibold text-pk-text">Doctors today</h3>
              </div>
              <div className="p-4 space-y-3">
                {doctorRail.length === 0 ? (
                  <p className="text-xs text-pk-text-muted">No doctors assigned to today&apos;s appointments.</p>
                ) : (
                  doctorRail.map((doc) => (
                    <div key={doc.name} className="flex items-start gap-3">
                      {/* Status dot */}
                      <div
                        className="mt-1 w-2 h-2 rounded-pk-full flex-shrink-0"
                        style={{
                          background: doc.status === "In chair"
                            ? "var(--pk-accent)"
                            : doc.status === "Done"
                            ? "var(--pk-success-solid)"
                            : "var(--pk-border-strong)",
                        }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-pk-text truncate">{doc.name}</p>
                        <p className="text-xs text-pk-text-muted">
                          {doc.status === "In chair" && doc.currentPatient
                            ? `In chair · ${doc.currentPatient}`
                            : doc.status === "Free" && doc.nextTime
                            ? `Free · next ${doc.nextTime}`
                            : doc.status === "Done"
                            ? `Done · ${doc.done}/${doc.total} seen`
                            : doc.status}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Zone B — Stat strip ─────────────────────────────────────────── */}
        <section aria-label="Today's metrics">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard
              label="Total Patients"
              value={stats.totalPatients}
              iconBg="bg-pk-teal-100"
              icon={
                <svg className="w-6 h-6 text-pk-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <StatCard
              label="Today's Appointments"
              value={stats.todayAppointments}
              iconBg="bg-pk-success-fill"
              icon={
                <svg className="w-6 h-6 text-pk-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />
            <StatCard
              label="Open Visits"
              value={stats.pendingVisits}
              iconBg="bg-pk-warning-fill"
              icon={
                <svg className="w-6 h-6 text-pk-warning-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              }
            />
            <StatCard
              label="Monthly Revenue"
              value={formatCurrency(stats.monthlyRevenue)}
              iconBg="bg-pk-neutral-100"
              icon={
                <svg className="w-6 h-6 text-pk-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="Today's Revenue"
              value={formatCurrency(stats.todayRevenue)}
              iconBg="bg-pk-success-fill"
              icon={
                <svg className="w-6 h-6 text-pk-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="Outstanding Dues"
              value={formatCurrency(stats.outstandingDues)}
              iconBg="bg-pk-danger-fill"
              icon={
                <svg className="w-6 h-6 text-pk-danger-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>
        </section>

        {/* ── Zone C — Quick Actions ──────────────────────────────────────── */}
        <section aria-label="Quick actions">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href="/dashboard/visits/new"
              className="flex items-center gap-3 p-4 rounded-pk-md border border-pk-border bg-pk-surface hover:bg-pk-teal-50 hover:border-pk-teal-200 transition group"
            >
              <div className="w-9 h-9 bg-pk-teal-100 rounded-pk-sm flex items-center justify-center group-hover:bg-pk-teal-200 transition flex-shrink-0">
                <svg className="w-5 h-5 text-pk-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-pk-text">New Visit</p>
                <p className="text-xs text-pk-text-muted">Walk-in or appointment</p>
              </div>
            </Link>

            <Link
              href="/dashboard/patients/new"
              className="flex items-center gap-3 p-4 rounded-pk-md border border-pk-border bg-pk-surface hover:bg-pk-teal-50 hover:border-pk-teal-200 transition group"
            >
              <div className="w-9 h-9 bg-pk-teal-100 rounded-pk-sm flex items-center justify-center group-hover:bg-pk-teal-200 transition flex-shrink-0">
                <svg className="w-5 h-5 text-pk-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-pk-text">New Patient</p>
                <p className="text-xs text-pk-text-muted">Register patient</p>
              </div>
            </Link>

            <Link
              href="/dashboard/appointments/new"
              className="flex items-center gap-3 p-4 rounded-pk-md border border-pk-border bg-pk-surface hover:bg-pk-success-fill hover:border-pk-success-border transition group"
            >
              <div className="w-9 h-9 bg-pk-success-fill rounded-pk-sm flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-pk-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-pk-text">Book Appointment</p>
                <p className="text-xs text-pk-text-muted">Schedule visit</p>
              </div>
            </Link>

            <Link
              href="/dashboard/billing"
              className="flex items-center gap-3 p-4 rounded-pk-md border border-pk-border bg-pk-surface hover:bg-pk-warning-fill hover:border-pk-warning-border transition group"
            >
              <div className="w-9 h-9 bg-pk-warning-fill rounded-pk-sm flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-pk-warning-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-pk-text">Billing Queue</p>
                <p className="text-xs text-pk-text-muted">Manage invoices</p>
              </div>
            </Link>
          </div>
        </section>

      </main>
    </div>
  );
}
