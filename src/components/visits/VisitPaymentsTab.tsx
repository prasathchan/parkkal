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
        <div className="bg-pk-surface-raised rounded-lg p-4 text-center">
          <p className="text-xs text-pk-text-muted mb-1">Total Bill</p>
          <p className="text-lg font-bold text-pk-text">{formatCurrency(visit.totalAmount)}</p>
        </div>
        <div className="bg-pk-success-fill rounded-lg p-4 text-center">
          <p className="text-xs text-pk-text-muted mb-1">Total Paid</p>
          <p className="text-lg font-bold text-pk-success-text">{formatCurrency(visit.paidAmount)}</p>
        </div>
        <div className={`rounded-lg p-4 text-center ${due > 0 ? "bg-pk-danger-fill" : "bg-pk-surface-raised"}`}>
          <p className="text-xs text-pk-text-muted mb-1">Balance Due</p>
          <p className={`text-lg font-bold ${due > 0 ? "text-pk-danger-text" : "text-pk-text-muted"}`}>{formatCurrency(due)}</p>
        </div>
      </div>

      {/* Payments History */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-pk-surface-raised">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-pk-text-secondary">Date</th>
              <th className="text-left px-3 py-2 font-semibold text-pk-text-secondary">For</th>
              <th className="text-right px-3 py-2 font-semibold text-pk-text-secondary">Amount</th>
              <th className="text-left px-3 py-2 font-semibold text-pk-text-secondary">Method</th>
              <th className="text-left px-3 py-2 font-semibold text-pk-text-secondary">Reference</th>
              <th className="text-left px-3 py-2 font-semibold text-pk-text-secondary">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pk-border">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-pk-text-muted">No payments recorded yet</td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="hover:bg-pk-surface-raised">
                  <td className="px-3 py-2.5 text-pk-text-muted whitespace-nowrap">{new Date(p.paidAt).toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2.5">
                    {p.treatmentId ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-pk-neutral-50 text-pk-neutral-700 border border-pk-neutral-200 px-2 py-0.5 rounded-full font-medium">
                        🦷 {p.treatmentDescription ?? "Treatment Plan"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-pk-surface-sunken text-pk-text-muted px-2 py-0.5 rounded-full">
                        General
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-pk-success-text">{formatCurrency(p.amount)}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs bg-pk-teal-100 text-pk-teal-700 px-2 py-0.5 rounded-full">{p.paymentMethod}</span>
                  </td>
                  <td className="px-3 py-2.5 text-pk-text-muted">{p.referenceNumber || "—"}</td>
                  <td className="px-3 py-2.5 text-pk-text-muted">{p.notes || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {visit.status === "OPEN" && due > 0 && (
        <button
          onClick={onOpenPayModal}
          className="bg-pk-success text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pk-success transition"
        >
          + Add Payment
        </button>
      )}
    </div>
  );
}
