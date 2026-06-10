"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { formatCurrency } from "@/lib/utils";
import { ToothChart } from "@/components/ui/tooth-chart";
import { NewTreatmentModal } from "@/components/treatments/NewTreatmentModal";
import { treatmentsApi, patientsApi, authApi, ApiError } from "@/api";
import type { Treatment, Patient } from "@/types";
import type { TreatmentStatus } from "@/constants/treatment";

// Alias for readability within this page
type TreatmentRecord = Treatment;

const LIMIT = 50;

export default function TreatmentsPage() {
  const [treatments, setTreatments] = useState<TreatmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [patientSearch, setPatientSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Patient search for filter bar
  const [filterPatients, setFilterPatients] = useState<Patient[]>([]);
  const [filterPatientId, setFilterPatientId] = useState("");
  const [filterPatientName, setFilterPatientName] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Current user — needed only to pass down to the modal
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");

  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch current user for modal role-gating
  useEffect(() => {
    authApi.me()
      .then((d) => {
        if (d.user) {
          setCurrentUserRole(d.user.role);
          setCurrentUserId(d.user.userId);
          setCurrentUserName(d.user.name || "");
        }
      })
      .catch(() => {});
  }, []);

  // Server enforces RBAC: DOCTOR role automatically sees only their own treatments.
  const fetchTreatments = useCallback(async (pageOffset: number, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const data = await treatmentsApi.list({
        patientId: filterPatientId || undefined,
        date:      dateFilter      || undefined,
        limit:     LIMIT,
        offset:    pageOffset,
      });
      const rows: TreatmentRecord[] = data.treatments ?? [];
      if (append) {
        setTreatments((prev) => [...prev, ...rows]);
      } else {
        setTreatments(rows);
      }
      setTotal(data.total ?? 0);
      setOffset(pageOffset + rows.length);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [filterPatientId, dateFilter]);

  useEffect(() => {
    setOffset(0);
    fetchTreatments(0, false);
  }, [fetchTreatments]);

  // Debounced filter patient search
  useEffect(() => {
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    if (!patientSearch.trim()) {
      setFilterPatients([]);
      setShowFilterDropdown(false);
      return;
    }
    filterDebounceRef.current = setTimeout(async () => {
      const data = await patientsApi.list({ search: patientSearch }).catch(() => ({ patients: [], total: 0 }));
      setFilterPatients(data.patients ?? []);
      setShowFilterDropdown(true);
    }, 300);
  }, [patientSearch]);

  function clearFilters() {
    setPatientSearch("");
    setFilterPatientId("");
    setFilterPatientName("");
    setDateFilter("");
  }

  const hasFilters = !!(filterPatientId || dateFilter);

  async function handleStatusChange(treatmentId: string, newStatus: TreatmentStatus) {
    setUpdatingStatus(treatmentId);
    setStatusError("");
    const prev = treatments.find((t) => t.id === treatmentId)?.status ?? "PLANNED";
    setTreatments((list) =>
      list.map((t) => (t.id === treatmentId ? { ...t, status: newStatus } : t))
    );
    try {
      await treatmentsApi.update(treatmentId, { status: newStatus });
    } catch (e) {
      setTreatments((list) =>
        list.map((t) => (t.id === treatmentId ? { ...t, status: prev } : t))
      );
      setStatusError(e instanceof ApiError ? e.message : "Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(null);
    }
  }

  function statusBadgeClass(status: TreatmentStatus): string {
    if (status === "COMPLETED")
      return "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700";
    if (status === "IN_PROGRESS")
      return "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700";
    return "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700";
  }

  const hasMore = offset < total;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Treatment Plans"
        breadcrumb={[{ label: "Dashboard" }, { label: "Treatment Plans" }]}
      />

      <main className="flex-1 p-6 space-y-4">
        {statusError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center justify-between">
            <span>{statusError}</span>
            <button onClick={() => setStatusError("")} className="text-red-500 hover:text-red-700 ml-4">✕</button>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Patient search filter */}
          <div className="relative">
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => {
                setPatientSearch(e.target.value);
                if (!e.target.value) {
                  setFilterPatientId("");
                  setFilterPatientName("");
                }
              }}
              placeholder="Filter by patient..."
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
            {showFilterDropdown && filterPatients.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 w-64">
                {filterPatients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setFilterPatientId(p.id);
                      setFilterPatientName(p.name);
                      setPatientSearch(p.name);
                      setShowFilterDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-slate-400">{p.patientCode}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-slate-500 hover:text-slate-700 underline"
            >
              Clear filters
            </button>
          )}

          <div className="ml-auto flex items-center gap-3">
            {!loading && total > 0 && (
              <span className="text-xs text-slate-400">
                {filterPatientName
                  ? `${total} for ${filterPatientName}`
                  : `${total} total`}
              </span>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Treatment Plan
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Patient</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Doctor</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Procedure / Item</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Tooth</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">Loading...</td>
                  </tr>
                ) : treatments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      {hasFilters ? "No treatments match your filters." : "No treatment records found"}
                    </td>
                  </tr>
                ) : (
                  treatments.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{t.patientName}</div>
                        <div className="text-xs text-slate-400">{t.patientCode}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{t.doctorName || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900">{t.description}</div>
                        {t.procedure && (
                          <div className="text-xs text-slate-400">{t.procedure}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {t.toothNumbers ? (
                          <ToothChart
                            value={t.toothNumbers.split(",").map((s) => s.trim()).filter(Boolean)}
                            readOnly
                            compact
                          />
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={t.status || "PLANNED"}
                          disabled={updatingStatus === t.id}
                          onChange={(e) => handleStatusChange(t.id, e.target.value as TreatmentStatus)}
                          className={`${statusBadgeClass((t.status || "PLANNED") as TreatmentStatus)} border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 pr-6 disabled:opacity-50`}
                        >
                          <option value="PLANNED">PLANNED</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="COMPLETED">COMPLETED</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(t.cost ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/treatments/${t.id}`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                        >
                          View History
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          {!loading && hasMore && (
            <div className="px-4 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Showing {treatments.length} of {total}
              </span>
              <button
                onClick={() => fetchTreatments(offset, true)}
                disabled={loadingMore}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
              >
                {loadingMore
                  ? "Loading..."
                  : `Load more (${total - treatments.length} remaining)`}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* New Treatment Plan Modal — extracted component */}
      {showModal && (
        <NewTreatmentModal
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            setOffset(0);
            fetchTreatments(0, false);
          }}
        />
      )}
    </div>
  );
}
