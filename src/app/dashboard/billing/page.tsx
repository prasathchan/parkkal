"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { formatCurrency } from "@/lib/utils";
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

export default function BillingPage() {
  const [visits, setVisits] = useState<VisitBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/visits");
      const data = await res.json();
      setVisits(data.visits || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleMarkPaid(visit: VisitBilling) {
    const due = visit.totalAmount - visit.paidAmount;
    if (due <= 0) return;
    if (!confirm(`Record full payment of ${formatCurrency(due)} for visit ${visit.visitCode}?`)) return;
    setMarkingPaid(visit.id);
    try {
      const res = await fetch(`/api/visits/${visit.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: due,
          paymentMethod: "CASH",
          patientId: visit.patientId,
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

  const pending = visits.filter((v) => getBillingStatus(v) === "PENDING").length;
  const partial = visits.filter((v) => getBillingStatus(v) === "PARTIAL").length;
  const paid = visits.filter((v) => getBillingStatus(v) === "PAID").length;

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
            <div className="flex gap-2 text-xs">
              <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                {pending} Pending
              </span>
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {partial} Partial
              </span>
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">
                {paid} Paid
              </span>
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
              ) : (
                visits.map((v) => {
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
                        {v.doctorName ? `Dr. ${v.doctorName}` : "—"}
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
    </div>
  );
}
