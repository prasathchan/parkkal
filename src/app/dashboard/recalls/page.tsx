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
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useAsync } from "@/hooks/use-async";
import { recallsApi, ApiError } from "@/api";
import { useLocation } from "@/context/location-context";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import type { RecallVisit, RecallStatus } from "@/types";

type TabFilter = "all" | "unscheduled" | "scheduled" | "fulfilled" | "lapsed";

const LIMIT = 50;

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RecallStatus, { label: string; bg: string; text: string }> = {
  UNSCHEDULED: { label: "Not Booked", bg: "bg-pk-warning-fill",  text: "text-pk-warning-text" },
  SCHEDULED:   { label: "Booked",     bg: "bg-pk-teal-50",   text: "text-pk-teal-700"  },
  FULFILLED:   { label: "Attended",   bg: "bg-pk-success-fill",  text: "text-pk-success-text" },
  LAPSED:      { label: "Lapsed",     bg: "bg-pk-danger-fill",    text: "text-pk-danger-text"   },
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
      <span className="inline-flex items-center rounded-full bg-pk-danger-fill px-2 py-0.5 text-xs font-medium text-pk-danger-text">
        {days}d overdue
      </span>
    );
  }
  const days = row.daysUntilRecall ?? 0;
  if (days === 0)
    return <span className="inline-flex items-center rounded-full bg-pk-warning-fill px-2 py-0.5 text-xs font-medium text-pk-warning-text">Today</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-pk-success-fill px-2 py-0.5 text-xs font-medium text-pk-success-text">
      in {days}d
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecallsPage() {
  const { selectedLocationId, isMultiBranch } = useLocation();
  const [tab, setTab] = useState<TabFilter>("unscheduled");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notifying, setNotifying] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState("");

  const { data, loading, error, refetch } = useAsync(
    () => recallsApi.list({
      status:     tab === "all" ? "all" : tab,
      locationId: selectedLocationId ?? undefined,
      limit:      LIMIT,
      offset,
    }),
    [tab, offset, selectedLocationId],
  );

  const recalls: RecallVisit[] = data?.recalls ?? [];
  const total = data?.total ?? 0;

  function handleTabChange(t: TabFilter) {
    setTab(t);
    setOffset(0);
    setSelected(new Set());
    setNotifyMsg("");
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === recalls.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(recalls.map((r) => r.id)));
    }
  }

  async function handleSendReminders() {
    if (selected.size === 0) return;
    setNotifying(true);
    setNotifyMsg("");
    try {
      const result = await recallsApi.notify([...selected]);
      setNotifyMsg(`Sent ${result.sent} reminder${result.sent !== 1 ? "s" : ""}${result.skipped > 0 ? `, ${result.skipped} skipped (no email)` : ""}${result.failed > 0 ? `, ${result.failed} failed` : ""}.`);
      setSelected(new Set());
    } catch (e) {
      setNotifyMsg(e instanceof ApiError ? e.message : "Failed to send reminders.");
    } finally {
      setNotifying(false);
    }
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
          <h1 className="text-2xl font-bold text-pk-text">Recalls</h1>
          <p className="text-sm text-pk-text-muted mt-0.5">Patients due for a follow-up visit · <a href="/help/recalls" target="_blank" rel="noreferrer" className="text-pk-teal-600 hover:underline">How recalls work →</a></p>
        </div>
        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSendReminders}
                disabled={notifying}
                className="inline-flex items-center gap-2 rounded-pk-sm bg-pk-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-pk-teal-700 disabled:opacity-50 transition"
              >
                {notifying ? "Sending…" : `Send Reminder (${selected.size})`}
              </button>
              <InfoTooltip content="Sends an email reminder to the selected patients with their recall date. Patients without an email address are skipped." position="bottom" />
            </div>
          )}
          {actionableCount > 0 && (tab === "unscheduled" || tab === "lapsed") && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pk-warning-fill px-3 py-1 text-sm font-medium text-pk-warning-text">
              <span className="h-2 w-2 rounded-full bg-pk-warning" />
              {actionableCount} need booking
            </span>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 rounded-pk-sm bg-pk-surface-sunken p-1 w-fit flex-wrap">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            aria-pressed={tab === key}
            className={`rounded-pk-sm px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-pk-surface text-pk-text shadow-pk-e1"
                : "text-pk-text-secondary hover:text-pk-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error / notify feedback */}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {notifyMsg && (
        <div className="rounded-pk-sm border border-pk-teal-200 bg-pk-teal-50 px-4 py-3 text-sm text-pk-teal-700 flex items-center justify-between">
          <span>{notifyMsg}</span>
          <button onClick={() => setNotifyMsg("")} className="ml-4 text-pk-teal-500 hover:text-pk-teal-700 font-bold leading-none">&times;</button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-pk-sm border border-pk-border bg-pk-surface overflow-hidden">
        {loading ? (
          <div role="status" aria-label="Loading recalls…" className="p-4">
            <SkeletonTable rows={8} cols={7} />
          </div>
        ) : recalls.length === 0 ? (
          <EmptyState
            title="No recalls found"
            description={
              tab === "unscheduled" ? "All recalls have been booked — great!" :
              tab === "lapsed"      ? "No lapsed recalls" :
              tab === "scheduled"   ? "No upcoming booked recalls" :
              tab === "fulfilled"   ? "No attended recalls yet" :
              "Set a recall date on a visit to see it here"
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-pk-border">
              <thead className="bg-pk-surface-raised">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      className="rounded border-pk-border text-pk-teal-600 focus:ring-pk-teal-500"
                      checked={selected.size === recalls.length && recalls.length > 0}
                      onChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Recall Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Appointment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Doctor</th>
                  {isMultiBranch && <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Branch</th>}
                  <th className="px-4 py-3 text-left text-xs font-medium text-pk-text-muted uppercase tracking-wider">Visit</th>
                </tr>
              </thead>
              <tbody className="bg-pk-surface divide-y divide-pk-border">
                {recalls.map((row) => (
                  <tr key={row.id} className={`hover:bg-pk-surface-raised transition-colors ${selected.has(row.id) ? "bg-pk-teal-50" : ""}`}>

                    {/* Checkbox */}
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        className="rounded border-pk-border text-pk-teal-600 focus:ring-pk-teal-500"
                        checked={selected.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        aria-label={`Select ${row.patientName}`}
                      />
                    </td>

                    {/* Patient */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-pk-text text-sm">
                        <Link href={`/dashboard/patients/${row.patientId}`} className="hover:text-pk-teal-600">
                          {row.patientName ?? "—"}
                        </Link>
                      </div>
                      <div className="text-xs text-pk-text-muted">{row.patientCode} · {row.patientPhone}</div>
                    </td>

                    {/* Recall date */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-pk-text">{row.recallDate}</div>
                      <div className="mt-0.5"><DueBadge row={row} /></div>
                    </td>

                    {/* Recall status */}
                    <td className="px-4 py-3">
                      <RecallStatusBadge status={row.recallStatus} />
                    </td>

                    {/* Appointment — show details + link if booked, Book Now if not */}
                    <td className="px-4 py-3">
                      {row.recallAppointmentId ? (
                        <div>
                          <Link
                            href={`/dashboard/appointments/calendar?appointmentId=${row.recallAppointmentId}`}
                            className="text-sm font-medium text-pk-teal-600 hover:text-pk-teal-800 hover:underline"
                          >
                            {row.recallAppointmentDate}
                            {row.recallAppointmentTime && (
                              <span className="text-pk-text-muted"> · {row.recallAppointmentTime}</span>
                            )}
                          </Link>
                          <div className="text-xs text-pk-text-muted mt-0.5 capitalize">
                            {row.recallAppointmentStatus?.toLowerCase()}
                          </div>
                        </div>
                      ) : (
                        <Link
                          href={`/dashboard/appointments/new?patientId=${row.patientId}&recallVisitId=${row.id}&type=FOLLOWUP`}
                          className="inline-flex items-center gap-1.5 rounded-pk-sm bg-pk-teal-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-pk-teal-700 transition-colors"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Book Now
                        </Link>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3 text-sm text-pk-text-muted max-w-[180px] truncate">
                      {row.recallNotes ?? "—"}
                    </td>

                    {/* Doctor */}
                    <td className="px-4 py-3 text-sm text-pk-text-muted">{row.doctorName ?? "—"}</td>

                    {/* Branch */}
                    {isMultiBranch && (
                      <td className="px-4 py-3 text-xs text-pk-text-muted">
                        {(row as RecallVisit & { locationName?: string | null }).locationName ?? "—"}
                      </td>
                    )}

                    {/* Original visit link */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/visits/${row.id}`}
                        className="text-xs font-medium text-pk-teal-600 hover:text-pk-teal-800"
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
        <div className="flex items-center justify-between text-sm text-pk-text-muted">
          <span>Showing {offset + 1}–{Math.min(offset + recalls.length, total)} of {total}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="rounded-pk-sm border border-pk-border px-3 py-1.5 text-xs font-medium hover:bg-pk-surface-raised disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={offset + recalls.length >= total}
              className="rounded-pk-sm border border-pk-border px-3 py-1.5 text-xs font-medium hover:bg-pk-surface-raised disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
