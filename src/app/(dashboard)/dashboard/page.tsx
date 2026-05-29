import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Users,
  Calendar,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

  const [
    totalPatients,
    todayAppointments,
    pendingInvoices,
    monthlyRevenue,
    recentAppointments,
    recentPatients,
  ] = await Promise.all([
    prisma.patient.count(),
    prisma.appointment.count({
      where: {
        date: { gte: today, lt: tomorrow },
      },
    }),
    prisma.invoice.count({
      where: { status: { in: ["PENDING", "PARTIAL"] } },
    }),
    prisma.invoice.aggregate({
      where: {
        status: "PAID",
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { paidAmount: true },
    }),
    prisma.appointment.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { name: true, patientId: true } },
        doctor: { select: { name: true } },
      },
    }),
    prisma.patient.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    totalPatients,
    todayAppointments,
    pendingInvoices,
    monthlyRevenue: monthlyRevenue._sum.paidAmount ?? 0,
    recentAppointments,
    recentPatients,
  };
}

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "info" }> = {
  SCHEDULED: { label: "Scheduled", variant: "info" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
  NO_SHOW: { label: "No Show", variant: "warning" },
};

export default async function DashboardPage() {
  const session = await auth();
  const stats = await getDashboardStats();

  const user = session?.user as { name?: string; role?: string } | undefined;

  const statCards = [
    {
      title: "Total Patients",
      value: stats.totalPatients.toLocaleString(),
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/patients",
    },
    {
      title: "Today's Appointments",
      value: stats.todayAppointments.toLocaleString(),
      icon: Calendar,
      color: "text-green-600",
      bg: "bg-green-50",
      href: "/appointments",
    },
    {
      title: "Pending Invoices",
      value: stats.pendingInvoices.toLocaleString(),
      icon: FileText,
      color: "text-orange-600",
      bg: "bg-orange-50",
      href: "/billing",
    },
    {
      title: "Monthly Revenue",
      value: formatCurrency(Number(stats.monthlyRevenue)),
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-50",
      href: "/billing",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {getGreeting()}, {user?.name?.split(" ")[0] ?? "there"}!
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Here&apos;s what&apos;s happening at Parkkal Dental Clinic today
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">{card.title}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${card.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Appointments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold">Recent Appointments</CardTitle>
            <Link
              href="/appointments"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recentAppointments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No appointments yet</p>
            ) : (
              stats.recentAppointments.map((appt) => {
                const sc = statusConfig[appt.status] ?? { label: appt.status, variant: "default" as const };
                return (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {appt.patient.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {appt.time} · {formatDate(appt.date)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={sc.variant}>{sc.label}</Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Patients */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold">New Patients</CardTitle>
            <Link
              href="/patients"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recentPatients.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No patients yet</p>
            ) : (
              stats.recentPatients.map((patient) => (
                <Link
                  key={patient.id}
                  href={`/patients/${patient.id}`}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{patient.name}</p>
                    <p className="text-xs text-gray-500">
                      {patient.patientId} · {patient.phone}
                    </p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
