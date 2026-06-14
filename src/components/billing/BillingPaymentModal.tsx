"use client";

import { formatCurrency } from "@/lib/utils";
import type { Visit } from "@/types";

type PaymentMethod = "CASH" | "CARD" | "UPI" | "BANK_TRANSFER";

interface Props {
  visit: Visit;
  due: number;
  payMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function BillingPaymentModal({ visit, due, payMethod, onMethodChange, onConfirm, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="text-base font-bold text-pk-text">Record Payment</h3>
        <p className="text-sm text-pk-text-secondary">
          Visit <span className="font-mono font-medium text-pk-teal-700">{visit.visitCode}</span> —{" "}
          Amount: <span className="font-semibold">{formatCurrency(due)}</span>
        </p>
        <div>
          <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Payment Method</label>
          <select
            value={payMethod}
            onChange={(e) => onMethodChange(e.target.value as PaymentMethod)}
            className="w-full border border-pk-border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
          >
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onConfirm} className="flex-1 bg-pk-success text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pk-success transition">
            Confirm Payment
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-pk-border-strong rounded-lg text-sm font-medium text-pk-text-secondary hover:bg-pk-surface-raised transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
