"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeadCell,
} from "@/components/ui/table";

interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  type: string;
  notes?: string;
  patientName?: string;
  doctorName?: string;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFilter) params.set("date", dateFilter);
    if (statusFilter) params.set("status", statusFilter);
    try {
      const res = await fetch(`/api/appointments?${params}`);
      const data = await res.json();
      setAppointments(data.appointments || []);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, statusFilter]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Appointments"
        breadcrumb={[{ label: "Dashboard" }, { label: "Appointments" }]}
      />

      <main className="flex-1 p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex gap-3 flex-wrap">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="NO_SHOW">No Show</option>
              </select>
              {(dateFilter || statusFilter) && (
                <button
                  onClick={() => { setDateFilter(""); setStatusFilter(""); }}
                  className="text-xs text-slate-500 hover:text-slate-800 px-2"
                >
                  Clear filters
                </button>
              )}
            </div>
            <Link href="/dashboard/appointments/new">
              <Button size="sm">
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Appointment
              </Button>
            </Link>
          </div>

          <Table>
            <TableHead>
              <tr>
                <TableHeadCell>Patient</TableHeadCell>
                <TableHeadCell>Doctor</TableHeadCell>
                <TableHeadCell>Date & Time</TableHeadCell>
                <TableHeadCell>Type</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                    No appointments found
                  </TableCell>
                </TableRow>
              ) : (
                appointments.map((apt) => (
                  <TableRow key={apt.id}>
                    <TableCell className="font-medium">
                      {apt.patientName || apt.patientId}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {apt.doctorName ? `Dr. ${apt.doctorName}` : "—"}
                    </TableCell>
                    <TableCell>
                      <p>{apt.appointmentDate}</p>
                      <p className="text-xs text-slate-500">{apt.appointmentTime}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs capitalize">{apt.type.toLowerCase()}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(apt.status)}>
                        {apt.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
