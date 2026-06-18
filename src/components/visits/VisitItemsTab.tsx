"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDoctorName } from "@/lib/utils";
import { CATEGORIES, DEFAULT_NEW_ITEM, type NewItemState, type Treatment, type VisitItem, type HistoryVisit } from "./types";
import { visitsApi, ApiError } from "@/api";
import { ITEM_CATEGORY_LABEL } from "@/constants/visit";
import { PAYMENT_METHOD } from "@/constants";
import { TreatmentPickerModal } from "./TreatmentPickerModal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { STATUS_COLORS } from "./types";

interface Payment { id: string; }

const QUICK_PAY_METHODS = [
  { value: "CASH",          label: "Cash" },
  { value: "UPI",           label: "UPI" },
  { value: "CARD",          label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank" },
];

interface Props {
  visitId: string;
  visitStatus: string;
  items: VisitItem[];
  treatments: Treatment[];
  payments: Payment[];
  prefillItem?: NewItemState | null;
  /** Outstanding balance — drives quick-pay default amount */
  due?: number;
  /** Patient visit history for collapsible section */
  history?: HistoryVisit[];
  patientName?: string;
  onRefresh: () => Promise<void>;
  onPageError: (msg: string) => void;
  onSuggestChart?: (toothNumbers: string[]) => void;
}

interface EditState {
  itemId: string;
  itemName: string;
  category: string;
  toothNumber: string;
  quantity: string;
  unitPrice: string;
  notes: string;
}

export function VisitItemsTab({ visitId, visitStatus, items, treatments, payments, prefillItem, due = 0, history, patientName, onRefresh, onPageError, onSuggestChart }: Props) {
  const [newItem, setNewItem] = useState<NewItemState>(prefillItem ?? DEFAULT_NEW_ITEM);
  const [addingItem, setAddingItem] = useState(false);
  const [addItemError, setAddItemError] = useState("");
  const [editState, setEditState] = useState<EditState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showTreatmentPicker, setShowTreatmentPicker] = useState(false);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);

  // Quick-pay state
  const [qpAmount, setQpAmount] = useState(() => due > 0 ? String(due.toFixed(2)) : "");
  const [qpMethod, setQpMethod] = useState("CASH");
  const [qpSubmitting, setQpSubmitting] = useState(false);
  const [qpError, setQpError] = useState("");
  const [qpSuccess, setQpSuccess] = useState(false);

  // History section
  const [showHistory, setShowHistory] = useState(false);

  const hasPayments = payments.length > 0;

  // Sync prefill from parent (e.g., "Add to Bill" from treatment tab)
  // We use a key pattern: parent passes prefillItem and we capture it into local state on mount.
  // Since tab switching re-mounts the component, the initial useState captures the prefill correctly.

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setAddingItem(true);
    setAddItemError("");
    try {
      await visitsApi.items.add(visitId, {
        ...newItem,
        quantity: Number(newItem.quantity),
        unitPrice: Number(newItem.unitPrice),
      });
      // Fire chart suggestion if this was a treatment-linked item
      if (newItem.linkedTreatmentId && onSuggestChart) {
        const tx = treatments.find((t) => t.id === newItem.linkedTreatmentId);
        if (tx?.toothNumbers) {
          const toothNumbers = tx.toothNumbers
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          if (toothNumbers.length > 0) onSuggestChart(toothNumbers);
        }
      }
      setNewItem(DEFAULT_NEW_ITEM);
      await onRefresh();
    } catch (e) {
      setAddItemError(e instanceof ApiError ? e.message : "Failed to add item");
    } finally {
      setAddingItem(false);
    }
  }

  async function doDeleteItem(itemId: string) {
    try {
      await visitsApi.items.delete(visitId, itemId);
      await onRefresh();
    } catch (e) {
      onPageError(e instanceof ApiError ? e.message : "Failed to delete item");
    }
  }

  async function handleQuickPay(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(qpAmount);
    if (!amt || amt <= 0) { setQpError("Enter a valid amount"); return; }
    setQpSubmitting(true);
    setQpError("");
    try {
      await visitsApi.payments.add(visitId, {
        amount: amt,
        paymentMethod: qpMethod as typeof PAYMENT_METHOD[keyof typeof PAYMENT_METHOD],
        notes: "Quick payment",
      });
      setQpSuccess(true);
      setQpAmount("");
      setTimeout(() => setQpSuccess(false), 3000);
      await onRefresh();
    } catch (e) {
      setQpError(e instanceof ApiError ? e.message : "Payment failed");
    } finally {
      setQpSubmitting(false);
    }
  }

  function startEdit(item: VisitItem) {
    setEditState({
      itemId: item.id,
      itemName: item.itemName,
      category: item.category,
      toothNumber: item.toothNumber || "",
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      notes: item.notes || "",
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editState) return;
    setSavingEdit(true);
    try {
      await visitsApi.items.update(visitId, editState.itemId, {
        itemName: editState.itemName,
        category: editState.category as import("@/constants/visit").ItemCategory,
        toothNumber: editState.toothNumber || undefined,
        quantity: Number(editState.quantity),
        unitPrice: Number(editState.unitPrice),
        notes: editState.notes || undefined,
      });
      setEditState(null);
      await onRefresh();
    } catch (e) {
      onPageError(e instanceof ApiError ? e.message : "Failed to update item");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Add Item Form */}
      {visitStatus !== "CANCELLED" && (
        <form onSubmit={handleAddItem} className="bg-pk-surface-raised rounded-pk-sm p-4">
          {visitStatus === "COMPLETED" && (
            <p className="text-xs text-pk-warning-text mb-2">⚠️ Visit is completed — items added will update billing.</p>
          )}
          <p className="text-sm font-semibold text-pk-text-secondary mb-3">Add Item</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Category</label>
              <select
                value={newItem.category}
                onChange={(e) => {
                  const cat = e.target.value;
                  setNewItem({ itemName: "", category: cat, toothNumber: "", quantity: "1", unitPrice: "0", notes: "", linkedTreatmentId: "" });
                  if (cat === "TREATMENT") setShowTreatmentPicker(true);
                }}
                className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{ITEM_CATEGORY_LABEL[c as keyof typeof ITEM_CATEGORY_LABEL] ?? c}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs text-pk-text-muted mb-1">Item Name *</label>
              <input
                required
                value={newItem.itemName}
                onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                placeholder="Medicine / Procedure..."
              />
            </div>
            {/* Treatment picker */}
            {newItem.category === "TREATMENT" && (
              <div className="col-span-full">
                <label className="block text-xs text-pk-text-muted mb-1">Select Treatment Plan *</label>
                {treatments.length === 0 ? (
                  <p className="text-xs text-pk-warning-text mt-1">No treatment plans linked to this visit. Add one in the Treatment Plan tab first.</p>
                ) : (
                  <select
                    value={newItem.linkedTreatmentId}
                    onChange={(e) => {
                      const tx = treatments.find(t => t.id === e.target.value);
                      if (!tx) {
                        setNewItem(n => ({ ...n, linkedTreatmentId: "", itemName: "", unitPrice: "0", toothNumber: "" }));
                        return;
                      }
                      const allTeeth = tx.toothNumbers
                        ? tx.toothNumbers.split(",").map((s) => s.trim()).filter(Boolean).join(", ")
                        : "";
                      const outstanding = Math.max(0, tx.cost - (tx.billedAmount ?? 0));
                      setNewItem(n => ({
                        ...n,
                        linkedTreatmentId: tx.id,
                        itemName: tx.description,
                        unitPrice: String(outstanding > 0 ? outstanding : tx.cost),
                        toothNumber: allTeeth,
                        quantity: "1",
                      }));
                    }}
                    className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                  >
                    <option value="">— Pick a treatment plan —</option>
                    {treatments.map(tx => (
                      <option key={tx.id} value={tx.id}>
                        {tx.description}{tx.toothNumbers ? ` (Tooth ${tx.toothNumbers})` : ""} — Est. ₹{tx.cost.toLocaleString("en-IN")}
                      </option>
                    ))}
                  </select>
                )}
                {newItem.linkedTreatmentId && (
                  <p className="text-xs text-pk-text-muted mt-1">
                    Estimated cost pre-filled. Edit the Unit Price below to match what the patient agreed to pay.
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Tooth #</label>
              {newItem.linkedTreatmentId ? (
                <div className="w-full border border-pk-border bg-pk-surface-raised rounded-pk-sm px-3 py-2 text-sm text-pk-text min-h-[38px]">
                  {newItem.toothNumber || <span className="text-pk-text-muted">—</span>}
                </div>
              ) : (
                <select
                  value={newItem.toothNumber}
                  onChange={(e) => setNewItem({ ...newItem, toothNumber: e.target.value })}
                  className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                >
                  <option value="">— Any tooth</option>
                  <optgroup label="Upper Right">
                    {[11,12,13,14,15,16,17,18].map(n => <option key={n} value={String(n)}>{n}</option>)}
                  </optgroup>
                  <optgroup label="Upper Left">
                    {[21,22,23,24,25,26,27,28].map(n => <option key={n} value={String(n)}>{n}</option>)}
                  </optgroup>
                  <optgroup label="Lower Left">
                    {[31,32,33,34,35,36,37,38].map(n => <option key={n} value={String(n)}>{n}</option>)}
                  </optgroup>
                  <optgroup label="Lower Right">
                    {[41,42,43,44,45,46,47,48].map(n => <option key={n} value={String(n)}>{n}</option>)}
                  </optgroup>
                </select>
              )}
            </div>
            {!newItem.linkedTreatmentId && (
              <div>
                <label className="block text-xs text-pk-text-muted mb-1">Qty</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                  className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Unit Price (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newItem.unitPrice}
                onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
                className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1">
              <label className="block text-xs text-pk-text-muted mb-1">Notes</label>
              <input
                value={newItem.notes}
                onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                placeholder="Optional notes..."
              />
            </div>
            <div className="pt-5">
              <p className="text-sm font-semibold text-pk-text-secondary">
                = {formatCurrency(Number(newItem.quantity) * Number(newItem.unitPrice))}
              </p>
            </div>
            <div className="pt-5 flex items-center gap-3">
              <button
                type="submit"
                disabled={addingItem}
                className="bg-pk-teal-600 text-white px-4 py-2 rounded-pk-sm text-sm font-medium hover:bg-pk-teal-700 disabled:opacity-50 transition"
              >
                {addingItem ? "Adding..." : "Add"}
              </button>
              {addItemError && (
                <p className="text-xs text-pk-danger-text">{addItemError}</p>
              )}
            </div>
          </div>
        </form>
      )}

      {/* Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-pk-surface-raised">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-pk-text-secondary">Item</th>
              <th className="text-left px-3 py-2 font-semibold text-pk-text-secondary">Category</th>
              <th className="text-left px-3 py-2 font-semibold text-pk-text-secondary">Tooth</th>
              <th className="text-right px-3 py-2 font-semibold text-pk-text-secondary">Qty</th>
              <th className="text-right px-3 py-2 font-semibold text-pk-text-secondary">Unit Price</th>
              <th className="text-right px-3 py-2 font-semibold text-pk-text-secondary">Amount</th>
              {visitStatus !== "CANCELLED" && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-pk-border">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-6 text-pk-text-muted">No items added yet</td>
              </tr>
            ) : (
              items.map((item) => {
                const isEditing = editState?.itemId === item.id;
                if (isEditing && editState) {
                  return (
                    <tr key={item.id} className="bg-pk-teal-50">
                      <td className="px-3 py-2" colSpan={7}>
                        <form onSubmit={handleSaveEdit} className="flex flex-wrap gap-2 items-end">
                          <div>
                            <label className="block text-xs text-pk-text-muted mb-0.5">Category</label>
                            <select
                              value={editState.category}
                              onChange={(e) => setEditState({ ...editState, category: e.target.value })}
                              className="border border-pk-border-strong rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c} value={c}>{ITEM_CATEGORY_LABEL[c as keyof typeof ITEM_CATEGORY_LABEL] ?? c}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1 min-w-[140px]">
                            <label className="block text-xs text-pk-text-muted mb-0.5">Item Name *</label>
                            <input
                              required
                              value={editState.itemName}
                              onChange={(e) => setEditState({ ...editState, itemName: e.target.value })}
                              className="w-full border border-pk-border-strong rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-pk-text-muted mb-0.5">Tooth #</label>
                            <input
                              value={editState.toothNumber}
                              onChange={(e) => setEditState({ ...editState, toothNumber: e.target.value })}
                              placeholder="—"
                              className="w-20 border border-pk-border-strong rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-pk-text-muted mb-0.5">Qty</label>
                            <input
                              type="number" min="0.01" step="0.01"
                              value={editState.quantity}
                              onChange={(e) => setEditState({ ...editState, quantity: e.target.value })}
                              className="w-16 border border-pk-border-strong rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-pk-text-muted mb-0.5">Unit Price (₹)</label>
                            <input
                              type="number" min="0" step="0.01"
                              value={editState.unitPrice}
                              onChange={(e) => setEditState({ ...editState, unitPrice: e.target.value })}
                              className="w-24 border border-pk-border-strong rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                            />
                          </div>
                          <div className="flex-1 min-w-[100px]">
                            <label className="block text-xs text-pk-text-muted mb-0.5">Notes</label>
                            <input
                              value={editState.notes}
                              onChange={(e) => setEditState({ ...editState, notes: e.target.value })}
                              placeholder="Optional..."
                              className="w-full border border-pk-border-strong rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={savingEdit}
                              className="bg-pk-teal-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-pk-teal-700 disabled:opacity-50"
                            >
                              {savingEdit ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditState(null)}
                              className="border border-pk-border-strong text-pk-text-secondary px-3 py-1 rounded text-sm hover:bg-pk-surface-raised"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={item.id} className="hover:bg-pk-surface-raised">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-pk-text">{item.itemName}</div>
                      {item.notes && <div className="text-xs text-pk-text-muted">{item.notes}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs bg-pk-surface-sunken px-2 py-0.5 rounded-full">{item.category}</span>
                    </td>
                    <td className="px-3 py-2.5 text-pk-text-muted">{item.toothNumber || "—"}</td>
                    <td className="px-3 py-2.5 text-right">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(item.amount)}</td>
                    {visitStatus !== "CANCELLED" && (
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => startEdit(item)}
                            className="text-pk-teal-600 hover:text-pk-teal-800 text-xs font-medium"
                          >
                            Edit
                          </button>
                          {!hasPayments && (
                            <button
                              onClick={() => setConfirmDeleteItemId(item.id)}
                              className="text-pk-danger-text hover:text-pk-danger-text text-xs font-medium"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-pk-surface-raised border-t-2 border-pk-border">
              <tr>
                <td colSpan={5} className="px-3 py-2 text-right font-semibold text-pk-text-secondary">Subtotal</td>
                <td className="px-3 py-2 text-right font-bold text-pk-text">
                  {formatCurrency(items.reduce((sum, i) => sum + i.amount, 0))}
                </td>
                {visitStatus !== "CANCELLED" && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showTreatmentPicker && (
        <TreatmentPickerModal
          treatments={treatments}
          onSelect={(tx) => {
            const firstTooth = tx.toothNumbers ? tx.toothNumbers.split(",")[0].trim() : "";
            const outstanding = Math.max(0, tx.cost - (tx.billedAmount ?? 0));
            setNewItem((n) => ({
              ...n,
              linkedTreatmentId: tx.id,
              itemName: tx.description,
              unitPrice: String(outstanding > 0 ? outstanding : tx.cost),
              toothNumber: firstTooth,
            }));
            setShowTreatmentPicker(false);
          }}
          onClose={() => setShowTreatmentPicker(false)}
        />
      )}

      {confirmDeleteItemId && (
        <ConfirmModal
          title="Delete item?"
          message="This will remove the item from the bill."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => { const id = confirmDeleteItemId; setConfirmDeleteItemId(null); doDeleteItem(id); }}
          onCancel={() => setConfirmDeleteItemId(null)}
        />
      )}

      {/* Quick-pay row — only for OPEN visits with items */}
      {visitStatus === "OPEN" && items.length > 0 && (
        <div className="mt-6 pt-5 border-t border-pk-border">
          <p className="text-sm font-semibold text-pk-text mb-3">Record Payment</p>
          <form onSubmit={handleQuickPay} className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Amount (₹)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={qpAmount}
                onChange={(e) => { setQpAmount(e.target.value); setQpError(""); }}
                placeholder="0.00"
                className="w-32 text-sm border border-pk-border rounded-pk-sm px-3 py-1.5 bg-pk-surface text-pk-text focus:outline-none focus:ring-1 focus:ring-pk-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Method</label>
              <select
                value={qpMethod}
                onChange={(e) => setQpMethod(e.target.value)}
                className="text-sm border border-pk-border rounded-pk-sm px-3 py-1.5 bg-pk-surface text-pk-text focus:outline-none focus:ring-1 focus:ring-pk-teal-500"
              >
                {QUICK_PAY_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={qpSubmitting || !qpAmount}
              className="bg-pk-teal-600 text-white text-sm font-medium px-4 py-1.5 rounded-pk-sm hover:bg-pk-teal-700 transition disabled:opacity-50"
            >
              {qpSubmitting ? "Recording…" : "Record Payment"}
            </button>
            {qpSuccess && <span className="text-xs text-pk-success-text font-medium">✓ Payment recorded</span>}
            {qpError && <span className="text-xs text-pk-danger-text">{qpError}</span>}
          </form>
        </div>
      )}

      {/* Visit history — collapsible reference section */}
      {history && history.length > 0 && (
        <div className="mt-6 pt-5 border-t border-pk-border">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-pk-text-secondary hover:text-pk-text transition w-full"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showHistory ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Visit history{patientName ? ` for ${patientName}` : ""}
            <span className="text-xs bg-pk-surface-sunken text-pk-text-muted px-1.5 rounded-full ml-1">
              {history.length}
            </span>
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {history.map((h) => (
                <Link
                  key={h.id}
                  href={`/dashboard/visits/${h.id}`}
                  className="flex items-center justify-between p-3 border border-pk-border rounded-pk-sm hover:bg-pk-teal-50 hover:border-pk-teal-200 transition"
                >
                  <div>
                    <p className="text-sm font-mono text-pk-teal-700">{h.visitCode}</p>
                    <p className="text-xs text-pk-text-muted">{h.visitDate} · {formatDoctorName(h.doctorName)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(h.totalAmount)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[h.status] || "bg-pk-surface-sunken text-pk-text-secondary"}`}>
                      {h.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
