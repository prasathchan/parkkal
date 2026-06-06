"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/header";
import { formatCurrency, formatDoctorName } from "@/lib/utils";
import { getBillingStatus } from "@/lib/billing";
import { BILLING_STATUS_BADGE } from "@/constants/ui";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeadCell,
} from "@/components/ui/table";

interface VisitBilling {
  id: string;
  visitCode: string;
  visitDate: string;
  patientId: string;
  patientName: string | null;
  patientCode: string | null;
  doctorName: string | null;
  totalAmount: number;
  paidAmount: number;
  status: string;
}

type PaymentMethod = "CASH" | "CARD" | "UPI" | "BANK_TRANSFER";
type BillingFilter = "UNPAID" | "ALL";

const PAGE_SIZE = 50;

export default function BillingPage() {
  const [visits, setVisits] = useState<VisitBilling[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BillingFilter>("UNPAID");
  const filterRef = useRef<BillingFilter>("UNPAID");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<{ visit: VisitBilling; due: number } | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (pageIdx: number, searchStr: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageIdx * PAGE_SIZE),
      });
      if (searchStr) params.set("search", searchStr);
      // Pass billingStatus=UNPAID to the server so only unpaid visits are fetched —
      // avoids loading hundreds of paid visits just to filter them client-side.
      if (filterRef.current === "UNPAID") params.set("billingStatus", "UNPAID");
      const res = await fetch(`/api/visits?${params}`);
      if (!res.ok) throw new Error("Failed to load visits");
      const data = await res.json();
      setVisits(data.visits || []);
      setTotal(data.total ?? 0);
    } catch {
      setErrorMsg("Failed to load billing data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(page, search);
  }, [fetchData, page, search, filter]);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(0);
    }, 300);
  }

  function handleFilterChange(f: BillingFilter) {
    filterRef.current = f;
    setFilter(f);
    setPage(0);
  }

  function handleMarkPaid(visit: VisitBilling) {
    const due = visit.totalAmount - visit.paidAmount;
    if (due <= 0) return;
    setPayMethod("CASH");
    setPayModal({ visit, due });
  }

  async function confirmMarkPaid() {
    if (!payModal) return;
    const { visit, due } = payModal;
    setMarkingPaid(visit.id);
    setPayModal(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/visits/${visit.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: due, paymentMethod: payMethod }),
      });
      if (res.ok) {
        setErrorMsg(null);
        await fetchData(page, search);
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Failed to record payment");
      }
    } finally {
      setMarkingPaid(null);
    }
  }

  const allBillingStatuses = visits.map((v) => getBillingStatus(v.totalAmount, v.paidAmount));
  const pending = allBillingStatuses.filter((s) => s === "PENDING").length;
  const partial = allBillingStatuses.filter((s) => s === "PARTIAL").length;
  const paid = allBillingStatuses.filter((s) => s === "PAID").length;

  const displayedVisits = filter === "UNPAID"
    ? visits.filter((v) => getBillingStatus(v.totalAmount, v.paidAmount) !== "PAID")
    : visits;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Billing"
        breadcrumb={[{ label: "Dashboard" }, { label: "Billing" }]}
      />

      <main className="flex-1 p-6">
        {errorMsg && (
          <div className="mb-4 flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 font-medium">✕</button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Visit Billing Summary</h2>
              <p className="text-xs text-slate-500 mt-0.5">Financial summary per visit — payments are recorded inside each visit</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs">{pending} Pending</span>
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">{partial} Partial</span>
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">{paid} Paid</span>
            </div>
          </div>

          <div className="px-6 py-3 border-b border-slate-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="text"
              placeholder="Search by patient name or visit code…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-1">
              <button
                onClick={() => handleFilterChange("UNPAID")}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition ${filter === "UNPAID" ? "bg-slate-700 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                Unpaid Only
              </button>
              <button
                onClick={() => handleFilterChange("ALL")}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition ${filter === "ALL" ? "bg-slate-700 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                All Visits
              </button>
            </div>
          </div>

          <Table>
            <TableHead>
              <tr>
                <TableHeadCell>Visit Code</TableHeadCell>
                <TableHeadCell>Patient</TableHeadCell>
                <TableHeadCell>Doctor</TableHeadCell>
                <TableHeadCell>Date</TableHeadCell>
                <TableHeadCell>Total</TableHeadCell>
                <TableHeadCell>Paid</TableHeadCell>
                <TableHeadCell>Balance Due</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Action</TableHeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : displayedVisits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                    {filter === "UNPAID" && visits.length > 0 ? "No unpaid visits — all clear!" : "No visits found"}
                  </TableCell>
                </TableRow>
              ) : (
                displayedVisits.map((v) => {
                  const due = v.totalAmount - v.paidAmount;
                  const billingStatus = getBillingStatus(v.totalAmount, v.paidAmount);
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <a href={`/dashboard/visits/${v.id}`} className="font-mono text-xs text-blue-700 hover:underline">
                          {v.visitCode}
                        </a>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>{v.patientName || v.patientId}</div>
                        {v.patientCode && <div className="text-xs text-slate-400">{v.patientCode}</div>}
                      </TableCell>
                      <TableCell className="text-slate-600">{formatDoctorName(v.doctorName)}</TableCell>
                      <TableCell className="text-slate-500">{v.visitDate}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(v.totalAmount)}</TableCell>
                      <TableCell className="text-green-700">{formatCurrency(v.paidAmount)}</TableCell>
                      <TableCell className={`font-medium ${due > 0 ? "text-red-600" : "text-slate-400"}`}>
                        {formatCurrency(due)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BILLING_STATUS_BADGE[billingStatus]}`}>
                          {billingStatus}
                        </span>
                      </TableCell>
                      <TableCell>
                        {due > 0 && v.status !== "CANCELLED" ? (
                          <button
                            onClick={() => handleMarkPaid(v)}
                            disabled={markingPaid === v.id}
                            className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                          >
                            {markingPaid === v.id ? "…" : "Mark Paid"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
              <span>
                Page {page + 1} of {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Record Payment</h3>
            <p className="text-sm text-slate-600">
              Visit <span className="font-mono font-medium text-blue-700">{payModal.visit.visitCode}</span> —{" "}
              Amount: <span className="font-semibold">{formatCurrency(payModal.due)}</span>
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={confirmMarkPaid}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
              >
                Confirm Payment
              </button>
              <button
                onClick={() => setPayModal(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
