"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { formatCurrency } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { visitsApi } from "@/api";
import { SkeletonTable } from "@/components/ui/skeleton";
import type { Visit } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  OPEN:      "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const LIMIT = 50;

export default function VisitsPage() {
  const [visits,       setVisits]       = useState<Visit[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [total,        setTotal]        = useState(0);
  const [offset,       setOffset]       = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter,   setDateFilter]   = useState("");
  const [search,       setSearch]       = useState("");

  const debouncedSearch = useDebounce(search, 300);

  const fetchVisits = useCallback(async (pageOffset: number, append = false) => {
    if (append) setLoadingMore(true);
    else        setLoading(true);

    try {
      const data = await visitsApi.list({
        status: (statusFilter || undefined) as import("@/constants/visit").VisitStatus | undefined,
        date:   dateFilter   || undefined,
        search: debouncedSearch.trim() || undefined,
        limit:  LIMIT,
        offset: pageOffset,
      });
      const rows = data.visits;
      setVisits((prev) => append ? [...prev, ...rows] : rows);
      setTotal(data.total ?? 0);
      setOffset(pageOffset + rows.length);
    } finally {
      if (append) setLoadingMore(false);
      else        setLoading(false);
    }
  }, [statusFilter, dateFilter, debouncedSearch]);

  useEffect(() => {
    setOffset(0);
    fetchVisits(0, false);
  }, [fetchVisits]);

  const hasMore = offset < total;
  const filtersActive = !!(statusFilter || dateFilter || debouncedSearch);

  function clearFilters() {
    setStatusFilter("");
    setDateFilter("");
    setSearch("");
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Visits"
        breadcrumb={[{ label: "Dashboard" }, { label: "Visits" }]}
      />
      <main className="flex-1 p-6 space-y-4">
        {/* Filters + New Visit */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <input
            type="date"
            aria-label="Filter by date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            aria-label="Search visits"
            placeholder="Search patient or visit code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
          />
          {filtersActive && (
            <button onClick={clearFilters} className="text-sm text-slate-500 hover:text-slate-700 underline">
              Clear filters
            </button>
          )}
          <div className="ml-auto flex items-center gap-3">
            {!loading && total > 0 && (
              <span className="text-xs text-slate-400">
                {filtersActive ? `${visits.length} of ${total} match` : `${total} total`}
              </span>
            )}
            <Link
              href="/dashboard/visits/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Visit
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div role="status" aria-label="Loading visits..." className="p-4">
              <SkeletonTable rows={8} cols={6} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Visit Code</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Patient</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Doctor</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Total</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Paid</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Due</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visits.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10">
                        <p className="text-slate-400">
                          {filtersActive ? "No visits match your filters." : "No visits yet."}
                        </p>
                        {filtersActive && (
                          <button onClick={clearFilters} className="text-blue-600 hover:underline text-sm mt-1">
                            Clear filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    visits.map((v) => {
                      const due = v.totalAmount - v.paidAmount;
                      return (
                        <tr key={v.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 font-mono text-xs text-blue-700">{v.visitCode}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{v.patientName}</div>
                            <div className="text-xs text-slate-400">{v.patientCode}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{v.doctorName}</td>
                          <td className="px-4 py-3 text-slate-700">{v.visitDate}</td>
                          <td className="px-4 py-3 text-right text-slate-900">{formatCurrency(v.totalAmount)}</td>
                          <td className="px-4 py-3 text-right text-green-700">{formatCurrency(v.paidAmount)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${due > 0 ? "text-red-600" : "text-slate-400"}`}>
                            {formatCurrency(due)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.status] ?? "bg-slate-100 text-slate-700"}`}>
                              {v.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Link href={`/dashboard/visits/${v.id}`} className="text-blue-600 hover:underline text-xs">
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && hasMore && (
            <div className="px-4 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">Showing {visits.length} of {total}</span>
              <button
                onClick={() => fetchVisits(offset, true)}
                disabled={loadingMore}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : `Load more (${total - visits.length} remaining)`}
              </button>
            </div>
          )}
          {!loading && !hasMore && total > LIMIT && (
            <div className="px-4 py-3 border-t border-slate-100 text-center text-xs text-slate-400">
              All {total} visits loaded
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
