"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { formatDoctorName } from "@/lib/utils";
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

const TYPE_LABELS: Record<string, string> = {
  CONSULTATION: "Consultation",
  CHECKUP: "Checkup",
  TREATMENT: "Treatment",
  FOLLOWUP: "Follow-up",
};

const LIMIT = 50;

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // The server enforces RBAC — DOCTOR role only sees their own appointments
  // regardless of any doctorId param. No need to fetch /api/auth/me here.
  const fetchAppointments = useCallback(async (pageOffset: number, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(pageOffset) });
    if (dateFilter) params.set("date", dateFilter);
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/appointments?${params}`);
      const data = await res.json();
      const rows: Appointment[] = data.appointments || [];
      if (append) {
        setAppointments((prev) => [...prev, ...rows]);
      } else {
        setAppointments(rows);
      }
      setTotal(data.total ?? 0);
      setOffset(pageOffset + rows.length);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [dateFilter, statusFilter]);

  useEffect(() => {
    setOffset(0);
    fetchAppointments(0, false);
  }, [fetchAppointments]);

  async function updateStatus(id: string, status: string, label: string) {
    if (!confirm(`Mark this appointment as "${label}"? This cannot be undone.`)) return;
    setUpdatingId(id);
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchAppointments(0, false);
    setUpdatingId(null);
  }

  const hasMore = offset < total;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Appointments"
        breadcrumb={[{ label: "Dashboard" }, { label: "Appointments" }]}
      />

      <main className="flex-1 p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex gap-3 flex-wrap items-center">
              <input
                type="date"
                aria-label="Filter by date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                aria-label="Filter by appointment status"
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
              {!loading && total > 0 && (
                <span className="text-xs text-slate-400">
                  {total} appointment{total !== 1 ? "s" : ""}
                </span>
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
                <TableHeadCell>Date &amp; Time</TableHeadCell>
                <TableHeadCell>Type</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Actions</TableHeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    No appointments found.{" "}
                    <Link href="/dashboard/appointments/new" className="text-blue-600 hover:underline">
                      Book one?
                    </Link>
                  </TableCell>
                </TableRow>
              ) : (
                appointments.map((apt) => (
                  <TableRow key={apt.id}>
                    <TableCell className="font-medium">
                      {apt.patientName || apt.patientId}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {formatDoctorName(apt.doctorName)}
                    </TableCell>
                    <TableCell>
                      <p>{apt.appointmentDate}</p>
                      <p className="text-xs text-slate-500">{apt.appointmentTime}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{TYPE_LABELS[apt.type] ?? apt.type}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(apt.status)}>
                        {apt.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(apt.status === "SCHEDULED" || apt.status === "IN_PROGRESS") && (
                          <Link
                            href={`/dashboard/visits/new?patientId=${apt.patientId}&appointmentId=${apt.id}&doctorId=${apt.doctorId}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-lg transition"
                          >
                            Start Visit
                          </Link>
                        )}
                        {apt.status === "SCHEDULED" && (
                          <>
                            <button
                              onClick={() => updateStatus(apt.id, "NO_SHOW", "No Show")}
                              disabled={updatingId === apt.id}
                              className="text-xs text-amber-600 hover:text-amber-800 border border-amber-200 hover:bg-amber-50 px-2 py-1 rounded-lg transition disabled:opacity-50"
                            >
                              No Show
                            </button>
                            <button
                              onClick={() => updateStatus(apt.id, "CANCELLED", "Cancelled")}
                              disabled={updatingId === apt.id}
                              className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 px-2 py-1 rounded-lg transition disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {apt.status !== "SCHEDULED" && apt.status !== "IN_PROGRESS" && (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination footer */}
          {!loading && hasMore && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Showing {appointments.length} of {total}
              </span>
              <button
                onClick={() => fetchAppointments(offset, true)}
                disabled={loadingMore}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
              >
                {loadingMore
                  ? "Loading..."
                  : `Load more (${total - appointments.length} remaining)`}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
