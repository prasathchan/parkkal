"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/header";
import { formatCurrency } from "@/lib/utils";

interface TreatmentRecord {
  id: string;
  patientName: string;
  patientCode: string;
  doctorName: string;
  visitDate: string;
  itemName: string;
  category: string;
  toothNumber: string | null;
  unitPrice: number;
  amount: number;
  createdAt: number;
}

interface Patient {
  id: string;
  name: string;
  patientCode: string;
}

interface Member {
  userId: string;
  name: string;
  role: string;
}

interface NewTreatmentForm {
  patientId: string;
  doctorId: string;
  description: string;
  procedure: string;
  toothNumbers: string;
  cost: string;
}

export default function TreatmentsPage() {
  const [treatments, setTreatments] = useState<TreatmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientSearch, setPatientSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showSlideover, setShowSlideover] = useState(false);

  // Patient search for filter bar
  const [filterPatients, setFilterPatients] = useState<Patient[]>([]);
  const [filterPatientId, setFilterPatientId] = useState("");
  const [filterPatientName, setFilterPatientName] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Slideover form state
  const [form, setForm] = useState<NewTreatmentForm>({
    patientId: "",
    doctorId: "",
    description: "",
    procedure: "",
    toothNumbers: "",
    cost: "0",
  });
  const [formPatientSearch, setFormPatientSearch] = useState("");
  const [formPatients, setFormPatients] = useState<Patient[]>([]);
  const [showFormPatientDropdown, setShowFormPatientDropdown] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTreatments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterPatientId) params.set("patientId", filterPatientId);
    if (dateFilter) params.set("date", dateFilter);
    const res = await fetch(`/api/treatments?${params}`);
    const data = await res.json();
    setTreatments(data.treatments || []);
    setLoading(false);
  }, [filterPatientId, dateFilter]);

  useEffect(() => {
    fetchTreatments();
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
      const res = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}`);
      const data = await res.json();
      setFilterPatients(data.patients || []);
      setShowFilterDropdown(true);
    }, 300);
  }, [patientSearch]);

  // Debounced form patient search
  useEffect(() => {
    if (formDebounceRef.current) clearTimeout(formDebounceRef.current);
    if (!formPatientSearch.trim()) {
      setFormPatients([]);
      setShowFormPatientDropdown(false);
      return;
    }
    formDebounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(formPatientSearch)}`);
      const data = await res.json();
      setFormPatients(data.patients || []);
      setShowFormPatientDropdown(true);
    }, 300);
  }, [formPatientSearch]);

  // Fetch members when slideover opens
  useEffect(() => {
    if (showSlideover && members.length === 0) {
      fetch("/api/org/members")
        .then((r) => r.json())
        .then((d) => {
          const all: Member[] = d.members || [];
          setMembers(all.filter((m) => m.role === "DOCTOR" || m.role === "ADMIN"));
        })
        .catch(() => {});
    }
  }, [showSlideover, members.length]);

  function openSlideover() {
    setForm({ patientId: "", doctorId: "", description: "", procedure: "", toothNumbers: "", cost: "0" });
    setFormPatientSearch("");
    setFormPatients([]);
    setSubmitError("");
    setShowSlideover(true);
  }

  function closeSlideover() {
    setShowSlideover(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientId || !form.doctorId || !form.description.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/treatments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: form.patientId,
          doctorId: form.doctorId,
          description: form.description,
          procedure: form.procedure || undefined,
          toothNumbers: form.toothNumbers || undefined,
          cost: parseFloat(form.cost) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Failed to create treatment plan");
        return;
      }
      closeSlideover();
      fetchTreatments();
    } catch {
      setSubmitError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  function clearFilters() {
    setPatientSearch("");
    setFilterPatientId("");
    setFilterPatientName("");
    setDateFilter("");
  }

  const hasFilters = filterPatientId || dateFilter;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Treatment Plans"
        breadcrumb={[{ label: "Dashboard" }, { label: "Treatment Plans" }]}
      />

      <main className="flex-1 p-6 space-y-4">
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

          <div className="ml-auto">
            <button
              onClick={openSlideover}
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
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">Loading...</td>
                  </tr>
                ) : treatments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      No treatment records found
                    </td>
                  </tr>
                ) : (
                  treatments.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{t.patientName}</div>
                        <div className="text-xs text-slate-400">{t.patientCode}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{t.doctorName}</td>
                      <td className="px-4 py-3 text-slate-700">{t.visitDate}</td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900">{t.itemName}</div>
                        {t.category && (
                          <div className="text-xs text-slate-400">{t.category}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{t.toothNumber || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(t.amount ?? t.unitPrice ?? 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Slideover overlay */}
      {showSlideover && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/30"
            onClick={closeSlideover}
          />
          {/* Panel */}
          <div className="w-full max-w-md bg-white shadow-xl flex flex-col h-full overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">New Treatment Plan</h2>
              <button
                onClick={closeSlideover}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 px-6 py-5 space-y-5">
              {/* Patient */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Patient <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formPatientSearch}
                    onChange={(e) => {
                      setFormPatientSearch(e.target.value);
                      if (!e.target.value) setForm((f) => ({ ...f, patientId: "" }));
                    }}
                    placeholder="Search patient..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {showFormPatientDropdown && formPatients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                      {formPatients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, patientId: p.id }));
                            setFormPatientSearch(p.name);
                            setShowFormPatientDropdown(false);
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
                {form.patientId && (
                  <p className="text-xs text-green-600 mt-1">Patient selected</p>
                )}
              </div>

              {/* Doctor */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Doctor <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.doctorId}
                  onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select doctor...</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  required
                  rows={3}
                  placeholder="Describe the treatment plan..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Procedure */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Procedure
                </label>
                <input
                  type="text"
                  value={form.procedure}
                  onChange={(e) => setForm((f) => ({ ...f, procedure: e.target.value }))}
                  placeholder="e.g. Root Canal Treatment, Crown Placement"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Tooth Numbers */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tooth Numbers
                </label>
                <input
                  type="text"
                  value={form.toothNumbers}
                  onChange={(e) => setForm((f) => ({ ...f, toothNumbers: e.target.value }))}
                  placeholder="e.g. 16, 17"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Cost */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Cost
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {submitError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting || !form.patientId || !form.doctorId || !form.description.trim()}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Saving..." : "Save Treatment Plan"}
                </button>
                <button
                  type="button"
                  onClick={closeSlideover}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
