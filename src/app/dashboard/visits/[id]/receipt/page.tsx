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
      <div className="p-8 text-center text-red-600">{error}</div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-gray-500">Loading receipt…</div>
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
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          Print
        </button>
        <button
          onClick={() => window.close()}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300"
        >
          Close
        </button>
      </div>

      {/* Receipt body */}
      <div className="max-w-[600px] mx-auto p-8 bg-white">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-5 border-b-2 border-gray-800">
          <div>
            {clinic.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clinic.logoUrl} alt="Logo" className="h-12 mb-2 object-contain" />
            )}
            <h1 className="text-xl font-bold text-gray-900">{clinic.name}</h1>
            {clinic.address && <p className="text-xs text-gray-500 mt-0.5">{clinic.address}</p>}
            {clinic.phone && <p className="text-xs text-gray-500">{clinic.phone}</p>}
            {clinic.email && <p className="text-xs text-gray-500">{clinic.email}</p>}
            {clinic.gstin && <p className="text-xs text-gray-500">GSTIN: {clinic.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-800">RECEIPT</p>
            <p className="text-sm font-mono text-gray-600 mt-1">{visit.visitCode}</p>
            <p className="text-xs text-gray-500 mt-0.5">{visit.visitDate}</p>
          </div>
        </div>

        {/* Patient info */}
        <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 rounded p-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Patient</p>
            <p className="text-sm font-semibold text-gray-800">{visit.patientName ?? "—"}</p>
            {visit.patientCode && <p className="text-xs text-gray-500">{visit.patientCode}</p>}
            {visit.patientPhone && <p className="text-xs text-gray-500">{visit.patientPhone}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Doctor</p>
            <p className="text-sm font-semibold text-gray-800">{visit.doctorName ?? "—"}</p>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-2 font-semibold text-gray-600">Description</th>
              <th className="text-center py-2 font-semibold text-gray-600">Qty</th>
              <th className="text-right py-2 font-semibold text-gray-600">Unit</th>
              <th className="text-right py-2 font-semibold text-gray-600">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2">
                  <p className="font-medium text-gray-800">{item.itemName}</p>
                  {item.toothNumber && <p className="text-xs text-gray-400">Tooth {item.toothNumber}</p>}
                </td>
                <td className="py-2 text-center text-gray-600">{item.quantity}</td>
                <td className="py-2 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                <td className="py-2 text-right font-medium text-gray-800">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-300">
            <tr>
              <td colSpan={3} className="py-2 text-right font-semibold text-gray-700">Total</td>
              <td className="py-2 text-right font-bold text-gray-900">{formatCurrency(visit.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Payments */}
        {payments.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Payments Received</p>
            <div className="space-y-1.5">
              {payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-green-50 rounded px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">{p.paymentMethod}</span>
                    {p.referenceNumber && <span className="text-xs text-gray-400 ml-2">Ref: {p.referenceNumber}</span>}
                    <span className="text-xs text-gray-400 ml-2">{formatDate(p.paidAt)}</span>
                  </div>
                  <span className="font-semibold text-green-700">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Balance summary */}
        <div className="border-t-2 border-gray-300 pt-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Paid</span>
            <span className="font-semibold text-green-700">{formatCurrency(visit.paidAmount)}</span>
          </div>
          {due > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 font-semibold">Balance Due</span>
              <span className="font-bold text-red-600">{formatCurrency(due)}</span>
            </div>
          )}
          {due <= 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status</span>
              <span className="font-semibold text-green-600">Paid in Full</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8 pt-4 border-t border-gray-200">
          Thank you for choosing {clinic.name}
        </p>
      </div>
    </>
  );
}
