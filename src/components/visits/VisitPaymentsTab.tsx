"use client";

import { formatCurrency } from "@/lib/utils";
import { type Payment, type Visit } from "./types";

interface Props {
  visit: Visit;
  payments: Payment[];
  due: number;
  onOpenPayModal: () => void;
}

export function VisitPaymentsTab({ visit, payments, due, onOpenPayModal }: Props) {
  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-50 rounded-lg p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Total Bill</p>
          <p className="text-lg font-bold text-slate-900">{formatCurrency(visit.totalAmount)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Total Paid</p>
          <p className="text-lg font-bold text-green-700">{formatCurrency(visit.paidAmount)}</p>
        </div>
        <div className={`rounded-lg p-4 text-center ${due > 0 ? "bg-red-50" : "bg-slate-50"}`}>
          <p className="text-xs text-slate-500 mb-1">Balance Due</p>
          <p className={`text-lg font-bold ${due > 0 ? "text-red-600" : "text-slate-400"}`}>{formatCurrency(due)}</p>
        </div>
      </div>

      {/* Payments History */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Date</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">For</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">Amount</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Method</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Reference</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-slate-400">No payments recorded yet</td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{new Date(p.paidAt).toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2.5">
                    {p.treatmentId ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-medium">
                        🦷 {p.treatmentDescription ?? "Treatment Plan"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                        General
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-green-700">{formatCurrency(p.amount)}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{p.paymentMethod}</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{p.referenceNumber || "—"}</td>
                  <td className="px-3 py-2.5 text-slate-500">{p.notes || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {visit.status === "OPEN" && due > 0 && (
        <button
          onClick={onOpenPayModal}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
        >
          + Add Payment
        </button>
      )}
    </div>
  );
}
