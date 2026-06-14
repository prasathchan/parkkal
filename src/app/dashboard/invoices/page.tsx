"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { formatCurrency } from "@/lib/utils";
import { useAsync } from "@/hooks/use-async";
import { useDebounce } from "@/hooks/use-debounce";
import { invoicesApi, patientsApi, ApiError } from "@/api";
import { EmptyState } from "@/components/ui/empty-state";
import type { Invoice, Patient } from "@/types";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeadCell,
} from "@/components/ui/table";

const STATUS_COLORS: Record<string, string> = {
  PAID:             "bg-green-100 text-green-700",
  PARTIALLY_PAID:   "bg-pk-teal-100 text-pk-teal-700",
  PENDING:          "bg-yellow-100 text-yellow-700",
  DRAFT:            "bg-pk-surface-sunken text-pk-text-secondary",
};

export default function InvoicesPage() {
  // Filters (client-side — small dataset)
  const [statusFilter,   setStatusFilter]   = useState("ALL");
  const [patientSearch,  setPatientSearch]  = useState("");

  // New Invoice slideover
  const [showSlideover,           setShowSlideover]           = useState(false);
  const [form,                    setForm]                    = useState({ patientId: "", totalAmount: "", paidAmount: "0", notes: "" });
  const [formPatientSearch,       setFormPatientSearch]       = useState("");
  const [showFormPatientDropdown, setShowFormPatientDropdown] = useState(false);
  const [submitting,              setSubmitting]              = useState(false);
  const [submitError,             setSubmitError]             = useState("");

  // Record Payment modal
  const [payModal,      setPayModal]      = useState<{ invoice: Invoice } | null>(null);
  const [payAmount,     setPayAmount]     = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError,      setPayError]      = useState("");

  // Debounced patient search inside the new-invoice form
  const debouncedFormSearch = useDebounce(formPatientSearch, 300);
  const { data: formPatientData } = useAsync<{ patients: Patient[] }>(
    () => debouncedFormSearch.trim()
      ? patientsApi.list({ search: debouncedFormSearch.trim(), limit: 10 })
      : Promise.resolve({ patients: [], total: 0, limit: 10, offset: 0 }),
    [debouncedFormSearch],
  );
  const formPatients: Patient[] = formPatientData?.patients ?? [];

  // Main invoice list
  const { data, loading, refetch } = useAsync(() => invoicesApi.list());
  const invoices: Invoice[] = data?.invoices ?? [];

  // Client-side filter
  const filtered = invoices.filter((inv) => {
    if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
    if (patientSearch) {
      const name = (inv.patientName ?? "").toLowerCase();
      if (!name.includes(patientSearch.toLowerCase())) return false;
    }
    return true;
  });

  const pending = invoices.filter((i) => i.status === "DRAFT" || i.status === "ISSUED").length;
  const partial = invoices.filter((i) => i.status === "PARTIALLY_PAID").length;
  const paid    = invoices.filter((i) => i.status === "PAID").length;

  function openSlideover() {
    setForm({ patientId: "", totalAmount: "", paidAmount: "0", notes: "" });
    setFormPatientSearch("");
    setSubmitError("");
    setShowSlideover(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientId) { setSubmitError("Please select a patient"); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      await invoicesApi.create({
        patientId:   form.patientId,
        notes:       form.notes || undefined,
      });
      setShowSlideover(false);
      refetch();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  function openPayModal(inv: Invoice) {
    const remaining = inv.totalAmount - inv.paidAmount;
    setPayAmount(remaining.toFixed(2));
    setPayError("");
    setPayModal({ invoice: inv });
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payModal) return;
    setPaySubmitting(true);
    setPayError("");
    try {
      await invoicesApi.recordPayment(payModal.invoice.id, {
        amount: parseFloat(payAmount) || 0,
        paymentMethod: "CASH",
      });
      setPayModal(null);
      refetch();
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setPaySubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Invoices"
        breadcrumb={[{ label: "Dashboard" }, { label: "Invoices" }]}
      />

      <main id="main-content" className="flex-1 p-6 space-y-4">
        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            placeholder="Search patient..."
            className="text-sm border border-pk-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pk-teal-500 w-52"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-pk-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="PARTIALLY_PAID">Partial</option>
            <option value="PAID">Paid</option>
          </select>
          <div className="ml-auto">
            <button
              onClick={openSlideover}
              className="inline-flex items-center gap-2 bg-pk-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pk-teal-700 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Invoice
            </button>
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl border border-pk-border shadow-sm">
          <div className="px-6 py-4 border-b border-pk-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-pk-text">Invoice List</h2>
              <p className="text-xs text-pk-text-muted mt-0.5">Manage standalone invoices for patients</p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">{pending} Pending</span>
              <span className="bg-pk-teal-100 text-pk-teal-700 px-2 py-1 rounded-full">{partial} Partial</span>
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">{paid} Paid</span>
            </div>
          </div>

          <Table>
            <TableHead>
              <tr>
                <TableHeadCell>Invoice ID</TableHeadCell>
                <TableHeadCell>Patient</TableHeadCell>
                <TableHeadCell>Amount</TableHeadCell>
                <TableHeadCell>Paid</TableHeadCell>
                <TableHeadCell>Balance</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Date</TableHeadCell>
                <TableHeadCell>Actions</TableHeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-pk-text-muted">Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState
                      title="No invoices found"
                      description="No invoices match your current filters."
                      action={{ label: "New Invoice", onClick: openSlideover }}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((inv) => {
                  const balance = inv.totalAmount - inv.paidAmount;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <span className="font-mono text-xs text-pk-teal-700">{inv.id.slice(0, 8)}</span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {inv.patientName ?? inv.patientId}
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(inv.totalAmount)}</TableCell>
                      <TableCell className="text-green-700">{formatCurrency(inv.paidAmount)}</TableCell>
                      <TableCell className={`font-medium ${balance > 0 ? "text-red-600" : "text-pk-text-muted"}`}>
                        {formatCurrency(balance)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] ?? "bg-pk-surface-sunken text-pk-text-secondary"}`}>
                          {inv.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-pk-text-muted">
                        {new Date(inv.createdAt).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {inv.status !== "PAID" && (
                            <button
                              onClick={() => openPayModal(inv)}
                              className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 transition"
                            >
                              Record Payment
                            </button>
                          )}
                          <a
                            href={`/api/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs border border-pk-border text-pk-text-secondary px-2.5 py-1 rounded-lg hover:bg-pk-surface-raised transition"
                          >
                            PDF
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* New Invoice Slideover */}
      {showSlideover && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowSlideover(false)} />
          <div className="w-full max-w-md bg-white shadow-xl flex flex-col h-full overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-pk-border">
              <h2 className="text-base font-semibold text-pk-text">New Invoice</h2>
              <button onClick={() => setShowSlideover(false)} aria-label="Close panel" className="text-pk-text-muted hover:text-pk-text-secondary transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">
                  Patient <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formPatientSearch}
                    onChange={(e) => {
                      setFormPatientSearch(e.target.value);
                      if (!e.target.value) setForm((f) => ({ ...f, patientId: "" }));
                      setShowFormPatientDropdown(true);
                    }}
                    placeholder="Search patient..."
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                  />
                  {showFormPatientDropdown && formPatients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-pk-border rounded-lg shadow-lg z-10">
                      {formPatients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, patientId: p.id }));
                            setFormPatientSearch(p.name);
                            setShowFormPatientDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-pk-surface-raised flex items-center gap-2"
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs text-pk-text-muted">{p.patientCode}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {form.patientId && <p className="text-xs text-green-600 mt-1">Patient selected</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Optional notes..."
                  className="w-full px-3 py-2 border border-pk-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 resize-none"
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
                  disabled={submitting || !form.patientId}
                  className="flex-1 bg-pk-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pk-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Saving..." : "Create Invoice"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSlideover(false)}
                  className="px-4 py-2 border border-pk-border-strong rounded-lg text-sm font-medium text-pk-text-secondary hover:bg-pk-surface-raised transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-pk-text mb-1">Record Payment</h3>
            <p className="text-sm text-pk-text-muted mb-4">
              Invoice <span className="font-mono">{payModal.invoice.id.slice(0, 8)}</span>
              {" · "}{payModal.invoice.patientName}
            </p>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-sm">
                <div className="bg-pk-surface-raised rounded-lg p-3">
                  <p className="text-xs text-pk-text-muted mb-0.5">Total</p>
                  <p className="font-semibold">{formatCurrency(payModal.invoice.totalAmount)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-pk-text-muted mb-0.5">Paid</p>
                  <p className="font-semibold text-green-700">{formatCurrency(payModal.invoice.paidAmount)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs text-pk-text-muted mb-0.5">Balance</p>
                  <p className="font-semibold text-red-600">{formatCurrency(payModal.invoice.totalAmount - payModal.invoice.paidAmount)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">
                  Amount to Pay (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-pk-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                  placeholder="0.00"
                />
              </div>

              {payError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{payError}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {paySubmitting ? "Processing..." : "Pay"}
                </button>
                <button
                  type="button"
                  onClick={() => { setPayModal(null); setPayError(""); }}
                  className="px-4 py-2.5 border border-pk-border rounded-lg text-sm font-medium text-pk-text-secondary hover:bg-pk-surface-raised transition"
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
