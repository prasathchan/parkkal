"use client";

/**
 * Receipt page — /dashboard/visits/[id]/receipt
 *
 * Opened in a new tab; auto-triggers window.print() on load.
 * Fetches data from the existing GET /api/visits/[id]/print endpoint.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { visitsApi } from "@/api";

interface ReceiptData {
  visit: {
    visitCode: string;
    visitDate: string;
    patientName: string | null;
    patientCode: string | null;
    patientPhone: string | null;
    doctorName: string | null;
    totalAmount: number;
    paidAmount: number;
    status: string;
  };
  items: Array<{
    itemName: string;
    category: string;
    toothNumber: string | null;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  payments: Array<{
    amount: number;
    paymentMethod: string;
    referenceNumber: string | null;
    notes: string | null;
    paidAt: number;
  }>;
  clinic: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    logoUrl: string | null;
    gstin: string | null;
    gstRegistered: boolean;
    cgstRate: number;
    sgstRate: number;
  };
}

function formatCurrency(n: number) {
  return `₹${n.toFixed(2)}`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    visitsApi.getPrint(id as string)
      .then((d) => {
        setData(d as ReceiptData);
      })
      .catch(() => setError("Failed to load receipt data."));
  }, [id]);

  useEffect(() => {
    if (data) {
      // Small delay so the page renders before print dialog opens
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (error) {
    return (
      <div className="p-8 text-center text-pk-danger-text">{error}</div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-pk-text-muted">Loading receipt…</div>
    );
  }

  const { visit, items, payments, clinic } = data;
  const due = visit.totalAmount - visit.paidAmount;

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 15mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: 'Arial', sans-serif; color: #1a1a1a; }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => window.print()}
          className="bg-pk-teal-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-pk-teal-700"
        >
          Print
        </button>
        <button
          onClick={() => window.close()}
          className="bg-pk-surface-raised text-pk-text px-4 py-2 rounded text-sm font-medium hover:bg-pk-border"
        >
          Close
        </button>
      </div>

      {/* Receipt body */}
      <div className="max-w-[600px] mx-auto p-8 bg-pk-surface">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-5 border-b-2 border-pk-text">
          <div>
            {clinic.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clinic.logoUrl} alt="Logo" className="h-12 mb-2 object-contain" />
            )}
            <h1 className="text-xl font-bold text-pk-text">{clinic.name}</h1>
            {clinic.address && <p className="text-xs text-pk-text-muted mt-0.5">{clinic.address}</p>}
            {clinic.phone && <p className="text-xs text-pk-text-muted">{clinic.phone}</p>}
            {clinic.email && <p className="text-xs text-pk-text-muted">{clinic.email}</p>}
            {clinic.gstin && <p className="text-xs text-pk-text-muted">GSTIN: {clinic.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-pk-text">RECEIPT</p>
            <p className="text-sm font-mono text-pk-text-secondary mt-1">{visit.visitCode}</p>
            <p className="text-xs text-pk-text-muted mt-0.5">{visit.visitDate}</p>
          </div>
        </div>

        {/* Patient info */}
        <div className="grid grid-cols-2 gap-4 mb-6 bg-pk-surface-raised rounded p-4">
          <div>
            <p className="text-xs font-semibold text-pk-text-muted uppercase tracking-wider mb-1">Patient</p>
            <p className="text-sm font-semibold text-pk-text">{visit.patientName ?? "—"}</p>
            {visit.patientCode && <p className="text-xs text-pk-text-muted">{visit.patientCode}</p>}
            {visit.patientPhone && <p className="text-xs text-pk-text-muted">{visit.patientPhone}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-pk-text-muted uppercase tracking-wider mb-1">Doctor</p>
            <p className="text-sm font-semibold text-pk-text">{visit.doctorName ?? "—"}</p>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-pk-border-strong">
              <th className="text-left py-2 font-semibold text-pk-text-secondary">Description</th>
              <th className="text-center py-2 font-semibold text-pk-text-secondary">Qty</th>
              <th className="text-right py-2 font-semibold text-pk-text-secondary">Unit</th>
              <th className="text-right py-2 font-semibold text-pk-text-secondary">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-pk-border">
                <td className="py-2">
                  <p className="font-medium text-pk-text">{item.itemName}</p>
                  {item.toothNumber && <p className="text-xs text-pk-text-muted">Tooth {item.toothNumber}</p>}
                </td>
                <td className="py-2 text-center text-pk-text-secondary">{item.quantity}</td>
                <td className="py-2 text-right text-pk-text-secondary">{formatCurrency(item.unitPrice)}</td>
                <td className="py-2 text-right font-medium text-pk-text">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-pk-border-strong">
            <tr>
              <td colSpan={3} className="py-2 text-right font-semibold text-pk-text-secondary">Total</td>
              <td className="py-2 text-right font-bold text-pk-text">{formatCurrency(visit.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Payments */}
        {payments.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-pk-text-muted uppercase tracking-wider mb-2">Payments Received</p>
            <div className="space-y-1.5">
              {payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-pk-success-fill rounded px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-pk-text-secondary">{p.paymentMethod}</span>
                    {p.referenceNumber && <span className="text-xs text-pk-text-muted ml-2">Ref: {p.referenceNumber}</span>}
                    <span className="text-xs text-pk-text-muted ml-2">{formatDate(p.paidAt)}</span>
                  </div>
                  <span className="font-semibold text-pk-success-text">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Balance summary */}
        <div className="border-t-2 border-pk-border-strong pt-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-pk-text-secondary">Total Paid</span>
            <span className="font-semibold text-pk-success-text">{formatCurrency(visit.paidAmount)}</span>
          </div>
          {due > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-pk-text-secondary font-semibold">Balance Due</span>
              <span className="font-bold text-pk-danger-text">{formatCurrency(due)}</span>
            </div>
          )}
          {due <= 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-pk-text-secondary">Status</span>
              <span className="font-semibold text-pk-success-text">Paid in Full</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-pk-text-muted mt-8 pt-4 border-t border-pk-border">
          Thank you for choosing {clinic.name}
        </p>
      </div>
    </>
  );
}
