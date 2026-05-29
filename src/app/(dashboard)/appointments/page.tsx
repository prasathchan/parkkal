import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, CalendarPlus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface SearchParams {
  status?: string;
  date?: string;
}

async function getAppointments(status?: string, date?: string) {
  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }

  if (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    where.date = { gte: d, lt: nextDay };
  }

  return prisma.appointment.findMany({
    where,
    orderBy: [{ date: "desc" }, { time: "asc" }],
    include: {
      patient: { select: { name: true, patientId: true } },
      doctor: { select: { name: true } },
    },
  });
}

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "info" }> = {
  SCHEDULED: { label: "Scheduled", variant: "info" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
  NO_SHOW: { label: "No Show", variant: "warning" },
};

const typeLabel: Record<string, string> = {
  CONSULTATION: "Consultation",
  CHECKUP: "Checkup",
  TREATMENT: "Treatment",
  FOLLOWUP: "Follow-up",
};

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const appointments = await getAppointments(searchParams.status, searchParams.date);

  const statuses = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-sm text-gray-500 mt-1">
            {appointments.length} appointment{appointments.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <Link href="/appointments/new">
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
            <CalendarPlus className="w-4 h-4" />
            New Appointment
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <form method="GET" className="flex flex-wrap gap-3">
            <div className="flex gap-2">
              <input
                type="date"
                name="date"
                defaultValue={searchParams.date ?? ""}
                className="h-10 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                name="status"
                defaultValue={searchParams.status ?? ""}
                className="h-10 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {statusConfig[s]?.label ?? s}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="outline" size="sm">
              Filter
            </Button>
            {(searchParams.status || searchParams.date) && (
              <Link href="/appointments">
                <Button variant="ghost" size="sm">Clear</Button>
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            Appointment List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          {appointments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No appointments found</p>
              <p className="text-gray-400 text-sm mt-1">
                {searchParams.status || searchParams.date
                  ? "Try different filters"
                  : "Schedule your first appointment"}
              </p>
              {!searchParams.status && !searchParams.date && (
                <Link href="/appointments/new">
                  <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
                    Schedule Appointment
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appt) => {
                  const sc = statusConfig[appt.status] ?? { label: appt.status, variant: "default" as const };
                  return (
                    <TableRow key={appt.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900">{appt.patient.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{appt.patient.patientId}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {appt.doctor.name}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="text-gray-900">{formatDate(appt.date)}</p>
                          <p className="text-gray-500 text-xs">{appt.time}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-700">
                          {typeLabel[appt.type] ?? appt.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                        {appt.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
