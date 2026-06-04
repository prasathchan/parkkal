"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { formatCurrency, formatDoctorName } from "@/lib/utils";
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

function getBillingStatus(visit: VisitBilling): "PAID" | "PARTIAL" | "PENDING" {
  if (visit.paidAmount >= visit.totalAmount && visit.totalAmount > 0) return "PAID";
  if (visit.paidAmount > 0) return "PARTIAL";
  return "PENDING";
}

type PaymentMethod = "CASH" | "CARD" | "UPI" | "BANK_TRANSFER";

type BillingFilter = "UNPAID" | "ALL";

export default function BillingPage() {
  const [visits, setVisits] = useState<VisitBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BillingFilter>("UNPAID");
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<{ visit: VisitBilling; due: number } | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Default to OPEN visits only so staff see actionable dues, not all history.
      const res = await fetch("/api/visits?status=OPEN&limit=200");
      const data = await res.json();
      setVisits(data.visits || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    try {
      const res = await fetch(`/api/visits/${visit.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: due,
          paymentMethod: payMethod,
        }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to record payment");
      }
    } finally {
      setMarkingPaid(null);
    }
  }

  const allBillingStatuses = visits.map(getBillingStatus);
  const pending = allBillingStatuses.filter((s) => s === "PENDING").length;
  const partial = allBillingStatuses.filter((s) => s === "PARTIAL").length;
  const paid = allBillingStatuses.filter((s) => s === "PAID").length;

  const displayedVisits = filter === "UNPAID"
    ? visits.filter((v) => getBillingStatus(v) !== "PAID")
    : visits;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Billing"
        breadcrumb={[{ label: "Dashboard" }, { label: "Billing" }]}
      />

      <main className="flex-1 p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Visit Billing Summary</h2>
              <p className="text-xs text-slate-500 mt-0.5">Financial summary per visit — payments are recorded inside each visit</p>
            </div>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">{pending} Pending</span>
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{partial} Partial</span>
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">{paid} Paid</span>
              <div className="flex gap-1 ml-2">
                <button
                  onClick={() => setFilter("UNPAID")}
                  className={`px-3 py-1 rounded-lg font-medium transition ${filter === "UNPAID" ? "bg-slate-700 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  Unpaid Only
                </button>
                <button
                  onClick={() => setFilter("ALL")}
                  className={`px-3 py-1 rounded-lg font-medium transition ${filter === "ALL" ? "bg-slate-700 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  All Open
                </button>
              </div>
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
                    Loading...
                  </TableCell>
                </TableRow>
              ) : visits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                    No visits found
                  </TableCell>
                </TableRow>
              ) : displayedVisits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                    {filter === "UNPAID" ? "No unpaid visits — all clear!" : "No visits found"}
                  </TableCell>
                </TableRow>
              ) : (
                displayedVisits.map((v) => {
                  const due = v.totalAmount - v.paidAmount;
                  const billingStatus = getBillingStatus(v);
                  const statusColors: Record<string, string> = {
                    PAID: "bg-green-100 text-green-700",
                    PARTIAL: "bg-blue-100 text-blue-700",
                    PENDING: "bg-yellow-100 text-yellow-700",
                  };
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
                      <TableCell className="text-slate-600">
                        {formatDoctorName(v.doctorName)}
                      </TableCell>
                      <TableCell className="text-slate-500">{v.visitDate}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(v.totalAmount)}
                      </TableCell>
                      <TableCell className="text-green-700">
                        {formatCurrency(v.paidAmount)}
                      </TableCell>
                      <TableCell className={`font-medium ${due > 0 ? "text-red-600" : "text-slate-400"}`}>
                        {formatCurrency(due)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[billingStatus]}`}>
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
                            {markingPaid === v.id ? "..." : "Mark Paid"}
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
        </div>
      </main>

      {/* Payment Method Modal */}
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
