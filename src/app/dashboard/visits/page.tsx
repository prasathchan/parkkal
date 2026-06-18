"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { formatCurrency } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { visitsApi } from "@/api";
import { useLocation } from "@/context/location-context";
import { exportVisits } from "@/api/export";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { Visit } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  OPEN:      "bg-pk-teal-100 text-pk-teal-800",
  COMPLETED: "bg-pk-success-fill text-pk-success-text",
  CANCELLED: "bg-pk-danger-fill text-pk-danger-text",
};

const LIMIT = 50;

export default function VisitsPage() {
  const { selectedLocationId, isMultiBranch } = useLocation();
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
        status:     (statusFilter || undefined) as import("@/constants/visit").VisitStatus | undefined,
        date:       dateFilter   || undefined,
        search:     debouncedSearch.trim() || undefined,
        locationId: selectedLocationId ?? undefined,
        limit:      LIMIT,
        offset:     pageOffset,
      });
      const rows = data.visits;
      setVisits((prev) => append ? [...prev, ...rows] : rows);
      setTotal(data.total ?? 0);
      setOffset(pageOffset + rows.length);
    } finally {
      if (append) setLoadingMore(false);
      else        setLoading(false);
    }
  }, [statusFilter, dateFilter, debouncedSearch, selectedLocationId]);

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
      <main id="main-content" className="flex-1 p-6 space-y-4">
        {/* Filters + New Visit */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-pk-border rounded-pk-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
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
            className="text-sm border border-pk-border rounded-pk-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
          />
          <input
            type="text"
            aria-label="Search visits"
            placeholder="Search patient or visit code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-pk-border rounded-pk-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pk-teal-500 min-w-[200px]"
          />
          {filtersActive && (
            <button onClick={clearFilters} className="text-sm text-pk-text-muted hover:text-pk-text-secondary underline">
              Clear filters
            </button>
          )}
          <div className="ml-auto flex items-center gap-3">
            {!loading && total > 0 && (
              <span className="text-xs text-pk-text-muted">
                {filtersActive ? `${visits.length} of ${total} match` : `${total} total`}
              </span>
            )}
            <button
              type="button"
              onClick={exportVisits}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-pk-sm text-sm font-medium border border-pk-border-strong text-pk-text-secondary hover:bg-pk-surface-raised transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <Link
              href="/dashboard/visits/new"
              className="inline-flex items-center gap-2 bg-pk-teal-600 text-white px-4 py-2 rounded-pk-sm text-sm font-medium hover:bg-pk-teal-700 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Visit
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="bg-pk-surface rounded-pk-lg border border-pk-border shadow-pk-e1 overflow-hidden">
          {loading ? (
            <div role="status" aria-label="Loading visits..." className="p-4">
              <SkeletonTable rows={8} cols={6} />
            </div>
          ) : visits.length === 0 ? (
            <EmptyState
              title={filtersActive ? "No visits match your filters" : "No visits yet"}
              description={filtersActive ? "Try adjusting your filters or clearing them." : "Record a new visit to get started."}
              action={filtersActive ? { label: "Clear filters", onClick: clearFilters } : { label: "New Visit", href: "/dashboard/visits/new" }}
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-pk-surface-raised border-b border-pk-border">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-pk-text-secondary">Visit Code</th>
                      <th className="text-left px-4 py-3 font-semibold text-pk-text-secondary">Patient</th>
                      <th className="text-left px-4 py-3 font-semibold text-pk-text-secondary">Doctor</th>
                      {isMultiBranch && <th className="text-left px-4 py-3 font-semibold text-pk-text-secondary">Branch</th>}
                      <th className="text-left px-4 py-3 font-semibold text-pk-text-secondary">Date</th>
                      <th className="text-right px-4 py-3 font-semibold text-pk-text-secondary">Total</th>
                      <th className="text-right px-4 py-3 font-semibold text-pk-text-secondary">Paid</th>
                      <th className="text-right px-4 py-3 font-semibold text-pk-text-secondary">Due</th>
                      <th className="text-center px-4 py-3 font-semibold text-pk-text-secondary">Status</th>
                      <th className="text-center px-4 py-3 font-semibold text-pk-text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pk-border">
                    {visits.map((v) => {
                      const due = v.totalAmount - v.paidAmount;
                      return (
                        <tr key={v.id} className="hover:bg-pk-surface-raised transition">
                          <td className="px-4 py-3 font-mono text-xs text-pk-teal-700">{v.visitCode}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-pk-text">{v.patientName}</div>
                            <div className="text-xs text-pk-text-muted">{v.patientCode}</div>
                          </td>
                          <td className="px-4 py-3 text-pk-text-secondary">{v.doctorName}</td>
                          {isMultiBranch && <td className="px-4 py-3 text-xs text-pk-text-secondary">{v.locationName ?? "—"}</td>}
                          <td className="px-4 py-3 text-pk-text-secondary">{v.visitDate}</td>
                          <td className="px-4 py-3 text-right text-pk-text">{formatCurrency(v.totalAmount)}</td>
                          <td className="px-4 py-3 text-right text-pk-success-text">{formatCurrency(v.paidAmount)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${due > 0 ? "text-pk-danger-text" : "text-pk-text-muted"}`}>
                            {formatCurrency(due)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.status] ?? "bg-pk-surface-sunken text-pk-text-secondary"}`}>
                              {v.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Link href={`/dashboard/visits/${v.id}`} className="text-pk-teal-600 hover:underline text-xs">View</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-pk-border">
                {visits.map((v) => {
                  const due = v.totalAmount - v.paidAmount;
                  return (
                    <Link key={v.id} href={`/dashboard/visits/${v.id}`} className="flex items-start justify-between px-4 py-3 hover:bg-pk-surface-raised transition">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-pk-teal-700">{v.visitCode}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[v.status] ?? "bg-pk-surface-sunken text-pk-text-secondary"}`}>{v.status}</span>
                        </div>
                        <p className="text-sm font-medium text-pk-text mt-0.5">{v.patientName}</p>
                        <p className="text-xs text-pk-text-muted">{v.visitDate} · {v.doctorName}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-semibold text-pk-text">{formatCurrency(v.totalAmount)}</p>
                        {due > 0 && <p className="text-xs text-pk-danger-text">Due {formatCurrency(due)}</p>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {!loading && hasMore && (
            <div className="px-4 py-4 border-t border-pk-border flex items-center justify-between">
              <span className="text-xs text-pk-text-muted">Showing {visits.length} of {total}</span>
              <button
                onClick={() => fetchVisits(offset, true)}
                disabled={loadingMore}
                className="text-sm text-pk-teal-600 hover:text-pk-teal-800 font-medium disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : `Load more (${total - visits.length} remaining)`}
              </button>
            </div>
          )}
          {!loading && !hasMore && total > LIMIT && (
            <div className="px-4 py-3 border-t border-pk-border text-center text-xs text-pk-text-muted">
              All {total} visits loaded
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
