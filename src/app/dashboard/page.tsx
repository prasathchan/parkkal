import Link from "next/link";
import { Header } from "@/components/header";
import { StatCard } from "@/components/stat-card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

async function getStats() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/dashboard/stats`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getRecentAppointments() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/appointments?limit=5`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.appointments || [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("pkd_session")?.value;
  const session = token ? await verifyToken(token) : null;

  const [statsData, appointments] = await Promise.all([
    getStats(),
    getRecentAppointments(),
  ]);

  const stats = statsData || {
    totalPatients: 0,
    todayAppointments: 0,
    pendingInvoices: 0,
    monthlyRevenue: 0,
    todayRevenue: 0,
    outstandingDues: 0,
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
            label="Pending Invoices"
            value={stats.pendingInvoices}
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

        {/* Recent Appointments + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Appointments */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Recent Appointments</h2>
              <Link
                href="/dashboard/appointments"
                className="text-xs text-blue-600 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {appointments.length === 0 ? (
                <p className="px-6 py-8 text-center text-slate-400 text-sm">
                  No appointments yet
                </p>
              ) : (
                appointments.map((apt: {
                  id: string;
                  patientName?: string;
                  doctorName?: string;
                  appointmentDate: string;
                  appointmentTime: string;
                  status: string;
                  type: string;
                }) => (
                  <div key={apt.id} className="px-6 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {apt.patientName || "Patient"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {apt.appointmentDate} at {apt.appointmentTime} · Dr. {apt.doctorName || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(apt.status)}>
                        {apt.status}
                      </Badge>
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
