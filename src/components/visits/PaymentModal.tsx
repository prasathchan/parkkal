"use client";

import { PAYMENT_METHODS } from "./types";
import { formatCurrency } from "@/lib/utils";

interface PayForm {
  amount: string;
  paymentMethod: string;
  referenceNumber: string;
  notes: string;
}

interface Props {
  due: number;
  payForm: PayForm;
  payError: string;
  paySubmitting: boolean;
  onChange: (form: PayForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function PaymentModal({ due, payForm, payError, paySubmitting, onChange, onSubmit, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Add Payment</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          {payError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{payError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Amount (max: {formatCurrency(due)}) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min="0.01"
              max={due}
              step="0.01"
              value={payForm.amount}
              onChange={(e) => onChange({ ...payForm, amount: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
            <select
              value={payForm.paymentMethod}
              onChange={(e) => onChange({ ...payForm, paymentMethod: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reference Number</label>
            <input
              value={payForm.referenceNumber}
              onChange={(e) => onChange({ ...payForm, referenceNumber: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="UPI ref / Card last 4..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input
              value={payForm.notes}
              onChange={(e) => onChange({ ...payForm, notes: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={paySubmitting}
              className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
            >
              {paySubmitting ? "Processing..." : "Record Payment"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
