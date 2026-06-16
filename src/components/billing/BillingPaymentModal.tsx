"use client";

import { formatCurrency } from "@/lib/utils";
import type { Visit } from "@/types";

type PaymentMethod = "CASH" | "CARD" | "UPI" | "BANK_TRANSFER";

interface Props {
  visit: Visit;
  due: number;
  payMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  amount: number;
  onAmountChange: (amount: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function BillingPaymentModal({ visit, due, payMethod, onMethodChange, amount, onAmountChange, onConfirm, onClose }: Props) {
  const isValid = amount > 0 && amount <= due;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-pk-surface rounded-pk-lg shadow-pk-e3 w-full max-w-sm p-6 space-y-4">
        <h3 className="text-base font-bold text-pk-text">Record Payment</h3>
        <p className="text-sm text-pk-text-secondary">
          Visit <span className="font-mono font-medium text-pk-teal-700">{visit.visitCode}</span> —{" "}
          Balance Due: <span className="font-semibold">{formatCurrency(due)}</span>
        </p>
        <div>
          <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Amount</label>
          <input
            type="number"
            min={1}
            max={due}
            step={0.01}
            value={amount || ""}
            onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
            placeholder="Enter amount"
            className="w-full border border-pk-border-strong rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
          />
          {amount > due && (
            <p className="text-xs text-pk-danger-text mt-1">Amount cannot exceed balance due ({formatCurrency(due)})</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Payment Method</label>
          <select
            value={payMethod}
            onChange={(e) => onMethodChange(e.target.value as PaymentMethod)}
            className="w-full border border-pk-border-strong rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
          >
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onConfirm}
            disabled={!isValid}
            className="flex-1 bg-pk-success text-white px-4 py-2 rounded-pk-sm text-sm font-medium hover:bg-pk-success disabled:opacity-50 transition"
          >
            Confirm Payment
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-pk-border-strong rounded-pk-sm text-sm font-medium text-pk-text-secondary hover:bg-pk-surface-raised transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
