"use client";

import { useState } from "react";
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
  /** Called when the form is submitted. allowOverpayment is true only after the user
   *  has explicitly confirmed they want to pay more than the outstanding balance. */
  onSubmit: (allowOverpayment: boolean) => void;
  onClose: () => void;
}

export function PaymentModal({ due, payForm, payError, paySubmitting, onChange, onSubmit, onClose }: Props) {
  const [confirmOverpay, setConfirmOverpay] = useState(false);

  const amount = parseFloat(payForm.amount) || 0;
  const isOverpayment = amount > due + 0.001;
  const overpayAmount = isOverpayment ? amount - due : 0;

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isOverpayment && !confirmOverpay) {
      setConfirmOverpay(true);
      return;
    }
    onSubmit(isOverpayment && confirmOverpay);
  }

  function handleAmountChange(val: string) {
    onChange({ ...payForm, amount: val });
    // Reset confirmation if user changes the amount
    if (confirmOverpay) setConfirmOverpay(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Add Payment</h3>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {payError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{payError}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Amount <span className="text-red-500">*</span>
              <span className="ml-1 font-normal text-slate-400">(outstanding: {formatCurrency(due)})</span>
            </label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={payForm.amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                isOverpayment ? "border-amber-400 focus:ring-amber-400" : "border-slate-200 focus:ring-blue-500"
              }`}
              placeholder="0.00"
            />
          </div>

          {/* Overpayment warning */}
          {isOverpayment && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${
              confirmOverpay
                ? "bg-amber-50 border-amber-300"
                : "bg-amber-50 border-amber-200"
            }`}>
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div className="flex-1">
                  <p className="font-medium text-amber-800">
                    {formatCurrency(amount)} exceeds the outstanding balance by {formatCurrency(overpayAmount)}
                  </p>
                  {!confirmOverpay ? (
                    <p className="text-amber-700 mt-0.5">
                      Click &ldquo;Record Payment&rdquo; again to confirm the overpayment, or adjust the amount.
                    </p>
                  ) : (
                    <p className="text-amber-700 mt-0.5 font-medium">
                      Confirmed. Click &ldquo;Record Payment&rdquo; to proceed.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

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
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition ${
                isOverpayment && !confirmOverpay
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {paySubmitting
                ? "Processing..."
                : isOverpayment && !confirmOverpay
                ? "Record Payment ↵ (confirm overpayment)"
                : "Record Payment"}
            </button>
            <button
              type="button"
              onClick={() => { onClose(); setConfirmOverpay(false); }}
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
