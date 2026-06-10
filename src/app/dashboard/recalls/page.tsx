"use client";

/**
 * Recalls Dashboard
 *
 * Shows patients who are due for a follow-up visit.
 * Each recall has a computed status:
 *
 *   UNSCHEDULED  — recall date set, not yet booked
 *   SCHEDULED    — appointment already booked
 *   FULFILLED    — patient attended the follow-up
 *   LAPSED       — recall date passed with no booking, or booking was cancelled
 *
 * Staff can:
 *   • Filter by status tab
 *   • Click "Book Now" on UNSCHEDULED/LAPSED rows → goes to New Appointment
 *     pre-filled with the patient + recall visit ID so the link is auto-created
 *   • See the booked appointment date on SCHEDULED rows
 */

import { useState } from "react";
import Link from "next/link";
import { SkeletonTable } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { recallsApi } from "@/api";
import type { RecallVisit, RecallStatus } from "@/types";

type TabFilter = "all" | "unscheduled" | "scheduled" | "fulfilled" | "lapsed";

const LIMIT = 50;

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RecallStatus, { label: string; bg: string; text: string }> = {
  UNSCHEDULED: { label: "Not Booked", bg: "bg-amber-50",  text: "text-amber-700" },
  SCHEDULED:   { label: "Booked",     bg: "bg-blue-50",   text: "text-blue-700"  },
  FULFILLED:   { label: "Attended",   bg: "bg-green-50",  text: "text-green-700" },
  LAPSED:      { label: "Lapsed",     bg: "bg-red-50",    text: "text-red-700"   },
};

function RecallStatusBadge({ status }: { status: RecallStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

// ─── Due-date badge ───────────────────────────────────────────────────────────

function DueBadge({ row }: { row: RecallVisit }) {
  if (row.isOverdue) {
    const days = Math.abs(row.daysUntilRecall ?? 0);
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        {days}d overdue
      </span>
    );
  }
  const days = row.daysUntilRecall ?? 0;
  if (days === 0)
    return <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Today</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      in {days}d
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecallsPage() {
  const [tab, setTab] = useState<TabFilter>("unscheduled");
  const [offset, setOffset] = useState(0);

  const { data, loading, error } = useAsync(
    () => recallsApi.list({ status: tab === "all" ? "all" : tab, limit: LIMIT, offset }),
    [tab, offset],
  );

  const recalls: RecallVisit[] = data?.recalls ?? [];
  const total = data?.total ?? 0;

  function handleTabChange(t: TabFilter) {
    setTab(t);
    setOffset(0);
  }

  const TABS: { key: TabFilter; label: string }[] = [
    { key: "unscheduled", label: "Not Booked" },
    { key: "lapsed",      label: "Lapsed"     },
    { key: "scheduled",   label: "Booked"     },
    { key: "fulfilled",   label: "Attended"   },
    { key: "all",         label: "All"        },
  ];

  const actionableCount = recalls.filter(
    (r) => r.recallStatus === "UNSCHEDULED" || r.recallStatus === "LAPSED",
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recalls</h1>
          <p className="text-sm text-gray-500 mt-0.5">Patients due for a follow-up visit</p>
        </div>
        {actionableCount > 0 && (tab === "unscheduled" || tab === "lapsed") && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {actionableCount} need booking
          </span>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit flex-wrap">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            aria-pressed={tab === key}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div role="status" aria-label="Loading recalls…" className="p-4">
            <SkeletonTable rows={8} cols={7} />
          </div>
        ) : recalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="h-10 w-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">No recalls found</p>
            <p className="text-xs text-gray-400 mt-1">
              {tab === "unscheduled" && "All recalls have been booked — great!"}
              {tab === "lapsed"      && "No lapsed recalls"}
              {tab === "scheduled"   && "No upcoming booked recalls"}
              {tab === "fulfilled"   && "No attended recalls yet"}
              {tab === "all"         && "Set a recall date on a visit to see it here"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recall Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Appointment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visit</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {recalls.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">

                    {/* Patient */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-sm">
                        <Link href={`/dashboard/patients/${row.patientId}`} className="hover:text-blue-600">
                          {row.patientName ?? "—"}
                        </Link>
                      </div>
                      <div className="text-xs text-gray-400">{row.patientCode} · {row.patientPhone}</div>
                    </td>

                    {/* Recall date */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{row.recallDate}</div>
                      <div className="mt-0.5"><DueBadge row={row} /></div>
                    </td>

                    {/* Recall status */}
                    <td className="px-4 py-3">
                      <RecallStatusBadge status={row.recallStatus} />
                    </td>

                    {/* Appointment — show details if booked, Book Now if not */}
                    <td className="px-4 py-3">
                      {row.recallAppointmentId ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {row.recallAppointmentDate}
                            {row.recallAppointmentTime && (
                              <span className="text-gray-500"> · {row.recallAppointmentTime}</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 capitalize">
                            {row.recallAppointmentStatus?.toLowerCase()}
                          </div>
                        </div>
                      ) : (
                        <Link
                          href={`/dashboard/appointments/new?patientId=${row.patientId}&recallVisitId=${row.id}&type=FOLLOWUP`}
                          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Book Now
                        </Link>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[180px] truncate">
                      {row.recallNotes ?? "—"}
                    </td>

                    {/* Doctor */}
                    <td className="px-4 py-3 text-sm text-gray-500">{row.doctorName ?? "—"}</td>

                    {/* Original visit link */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/visits/${row.id}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        {row.visitCode}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {offset + 1}–{Math.min(offset + recalls.length, total)} of {total}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={offset + recalls.length >= total}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
