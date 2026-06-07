"use client";

/**
 * Recalls Dashboard
 *
 * Shows patients who are due for a follow-up visit.
 * Staff can filter by overdue / upcoming / all and jump to the visit record.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SkeletonTable } from "@/components/ui/skeleton";

type RecallRow = {
  id: string;
  visitCode: string;
  visitDate: string;
  recallDate: string;
  recallNotes: string | null;
  status: string;
  patientId: string;
  patientName: string | null;
  patientCode: string | null;
  patientPhone: string | null;
  doctorName: string | null;
  isOverdue: boolean;
  daysUntilRecall: number | null;
};

type StatusFilter = "all" | "overdue" | "upcoming";

export default function RecallsPage() {
  const [recalls, setRecalls] = useState<RecallRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchRecalls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status: statusFilter, limit: String(limit), offset: String(offset) });
      const res = await fetch(`/api/recalls?${params}`);
      if (!res.ok) throw new Error("Failed to load recalls");
      const data = await res.json();
      setRecalls(data.recalls);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, offset]);

  useEffect(() => {
    fetchRecalls();
  }, [fetchRecalls]);

  // Reset pagination when filter changes
  function handleFilterChange(f: StatusFilter) {
    setStatusFilter(f);
    setOffset(0);
  }

  function formatRecallBadge(row: RecallRow) {
    if (row.isOverdue) {
      const days = Math.abs(row.daysUntilRecall ?? 0);
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          {days}d overdue
        </span>
      );
    }
    const days = row.daysUntilRecall ?? 0;
    if (days === 0) return <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Today</span>;
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        in {days}d
      </span>
    );
  }

  const overdueCount = recalls.filter((r) => r.isOverdue).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recalls</h1>
          <p className="text-sm text-gray-500 mt-0.5">Patients due for a follow-up visit</p>
        </div>
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            {overdueCount} overdue
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(["all", "overdue", "upcoming"] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            aria-pressed={statusFilter === f}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === f
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
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
            <SkeletonTable rows={8} cols={6} />
          </div>
        ) : recalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="h-10 w-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-sm font-medium text-gray-500">No recalls found</p>
            <p className="text-xs text-gray-400 mt-1">
              {statusFilter === "overdue"
                ? "No overdue recalls — great!"
                : statusFilter === "upcoming"
                ? "No upcoming recalls scheduled"
                : "Set a recall date on a visit to see it here"}
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recall Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visit</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {recalls.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 text-sm">
                      <Link href={`/dashboard/patients/${row.patientId}`} className="hover:text-blue-600">
                        {row.patientName ?? "—"}
                      </Link>
                    </div>
                    <div className="text-xs text-gray-400">{row.patientCode} · {row.patientPhone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{row.recallDate}</div>
                    <div className="mt-0.5">{formatRecallBadge(row)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.isOverdue ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                    }`}>
                      {row.isOverdue ? "Overdue" : "Upcoming"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{row.recallNotes ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{row.doctorName ?? "—"}</td>
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
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {offset + 1}–{Math.min(offset + recalls.length, total)} of {total}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
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
