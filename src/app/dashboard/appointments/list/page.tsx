"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { appointmentsApi, ApiError } from "@/api";
import { useLocation } from "@/context/location-context";
import type { Appointment } from "@/types";

const PAGE_SIZE = 50;

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED:   "bg-pk-teal-50 text-pk-teal-700",
  IN_PROGRESS: "bg-pk-warning-fill text-pk-warning-text",
  COMPLETED:   "bg-pk-success-fill text-pk-success-text",
  CANCELLED:   "bg-pk-neutral-100 text-pk-neutral-600",
  NO_SHOW:     "bg-pk-danger-fill text-pk-danger-text",
};

const STATUS_OPTIONS = ["", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"];

export default function AppointmentsListPage() {
  const { selectedLocationId, isMultiBranch } = useLocation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [total, setTotal]               = useState(0);
  const [offset, setOffset]             = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter]     = useState("");
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy]         = useState(false);
  const [bulkError, setBulkError]       = useState<string | null>(null);

  const fetchAppointments = useCallback(async (pageOffset: number, status: string, date: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof appointmentsApi.list>[0] = {
        limit: PAGE_SIZE,
        offset: pageOffset,
      };
      if (status) params.status = status;
      if (date)   params.startDate = date, params.endDate = date;
      if (selectedLocationId) params.locationId = selectedLocationId;
      const res = await appointmentsApi.list(params);
      setAppointments(res.appointments);
      setTotal(res.total);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAppointments(offset, statusFilter, dateFilter); }, [offset, statusFilter, dateFilter, selectedLocationId, fetchAppointments]);
  useEffect(() => { setOffset(0); }, [statusFilter, dateFilter]);

  function toggleAll() {
    if (selected.size === appointments.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(appointments.map((a) => a.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleBulkStatus(status: "COMPLETED" | "NO_SHOW") {
    if (selected.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkError(null);
    try {
      await appointmentsApi.bulkUpdateStatus(Array.from(selected), status);
      await fetchAppointments(offset, statusFilter, dateFilter);
    } catch (e) {
      setBulkError(e instanceof ApiError ? e.message : "Bulk update failed");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Appointments — List"
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "Appointments", href: "/dashboard/appointments/calendar" }, { label: "List" }]}
      />

      <main id="main-content" className="flex-1 p-6 space-y-4">

        {/* Filters + Calendar link */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="border border-pk-border rounded-pk-sm px-3 py-1.5 text-sm text-pk-text bg-pk-surface focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-pk-border rounded-pk-sm px-3 py-1.5 text-sm text-pk-text bg-pk-surface focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s || "All statuses"}</option>
              ))}
            </select>
            {(dateFilter || statusFilter) && (
              <button
                onClick={() => { setDateFilter(""); setStatusFilter(""); }}
                className="text-xs text-pk-teal-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
          <Link
            href="/dashboard/appointments/calendar"
            className="flex items-center gap-1.5 text-sm text-pk-text-secondary border border-pk-border px-3 py-1.5 rounded-pk-sm hover:bg-pk-surface-raised transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Calendar View
          </Link>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 bg-pk-teal-50 border border-pk-teal-200 rounded-pk-sm px-4 py-2.5 flex-wrap">
            <span className="text-sm font-medium text-pk-teal-800">{selected.size} selected</span>
            <button
              onClick={() => handleBulkStatus("COMPLETED")}
              disabled={bulkBusy}
              className="px-3 py-1.5 rounded-pk-sm bg-pk-success text-white text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              Mark Completed
            </button>
            <button
              onClick={() => handleBulkStatus("NO_SHOW")}
              disabled={bulkBusy}
              className="px-3 py-1.5 rounded-pk-sm bg-pk-danger text-white text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              Mark No-Show
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-pk-teal-700 hover:underline ml-auto"
            >
              Clear selection
            </button>
            {bulkError && <p className="w-full text-xs text-pk-danger-text">{bulkError}</p>}
          </div>
        )}

        {error && <ErrorState message={error} onRetry={() => fetchAppointments(offset, statusFilter, dateFilter)} />}

        <div className="bg-pk-surface rounded-pk-lg border border-pk-border overflow-hidden">
          {loading ? (
            <div className="p-4"><SkeletonTable rows={10} cols={6} /></div>
          ) : appointments.length === 0 ? (
            <EmptyState title="No appointments found" description="Try different filters or add a new appointment from the calendar." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-pk-border">
                <thead className="bg-pk-surface-raised">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === appointments.length && appointments.length > 0}
                        onChange={toggleAll}
                        className="rounded border-pk-border"
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Date & Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Patient</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Doctor</th>
                    {isMultiBranch && <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Branch</th>}
                    <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Visit</th>
                  </tr>
                </thead>
                <tbody className="bg-pk-surface divide-y divide-pk-border">
                  {appointments.map((appt) => (
                    <tr key={appt.id} className={`hover:bg-pk-surface-raised transition-colors ${selected.has(appt.id) ? "bg-pk-teal-50" : ""}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(appt.id)}
                          onChange={() => toggleOne(appt.id)}
                          className="rounded border-pk-border"
                          aria-label={`Select appointment for ${appt.patientName ?? appt.patientId}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-pk-text">{appt.appointmentDate}</div>
                        <div className="text-xs text-pk-text-muted">{appt.appointmentTime ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/patients/${appt.patientId}`} className="text-sm font-medium text-pk-teal-600 hover:underline">
                          {appt.patientName ?? appt.patientId}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-pk-text-secondary">{appt.doctorName ?? "—"}</td>
                      {isMultiBranch && <td className="px-4 py-3 text-xs text-pk-text-secondary">{appt.locationName ?? "—"}</td>}
                      <td className="px-4 py-3 text-sm text-pk-text-secondary capitalize">{appt.type?.toLowerCase()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[appt.status] ?? "bg-pk-surface-sunken text-pk-text-muted"}`}>
                          {appt.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {appt.visitId ? (
                          <Link href={`/dashboard/visits/${appt.visitId}`} className="text-xs text-pk-teal-600 hover:underline font-medium">
                            View Visit
                          </Link>
                        ) : (
                          <span className="text-xs text-pk-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-pk-text-muted">
            <span>Showing {offset + 1}–{Math.min(offset + appointments.length, total)} of {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0} className="rounded-pk-sm border border-pk-border px-3 py-1.5 text-xs font-medium hover:bg-pk-surface-raised disabled:opacity-40">Previous</button>
              <button onClick={() => setOffset(offset + PAGE_SIZE)} disabled={offset + appointments.length >= total} className="rounded-pk-sm border border-pk-border px-3 py-1.5 text-xs font-medium hover:bg-pk-surface-raised disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
