"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { CATEGORIES, DEFAULT_NEW_ITEM, type NewItemState, type Treatment, type VisitItem } from "./types";
import { visitsApi, ApiError } from "@/api";

interface Payment { id: string; }

interface Props {
  visitId: string;
  visitStatus: string;
  items: VisitItem[];
  treatments: Treatment[];
  payments: Payment[];
  prefillItem?: NewItemState | null;
  onRefresh: () => Promise<void>;
  onPageError: (msg: string) => void;
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

export function VisitItemsTab({ visitId, visitStatus, items, treatments, payments, prefillItem, onRefresh, onPageError }: Props) {
  const [newItem, setNewItem] = useState<NewItemState>(prefillItem ?? DEFAULT_NEW_ITEM);
  const [addingItem, setAddingItem] = useState(false);
  const [addItemError, setAddItemError] = useState("");
  const [editState, setEditState] = useState<EditState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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
      setNewItem(DEFAULT_NEW_ITEM);
      await onRefresh();
    } catch (e) {
      setAddItemError(e instanceof ApiError ? e.message : "Failed to add item");
    } finally {
      setAddingItem(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm("Delete this item?")) return;
    try {
      await visitsApi.items.delete(visitId, itemId);
      await onRefresh();
    } catch (e) {
      onPageError(e instanceof ApiError ? e.message : "Failed to delete item");
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
        <form onSubmit={handleAddItem} className="bg-pk-surface-raised rounded-lg p-4">
          {visitStatus === "COMPLETED" && (
            <p className="text-xs text-amber-600 mb-2">⚠️ Visit is completed — items added will update billing.</p>
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
                }}
                className="w-full border border-pk-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c === "TREATMENT" ? "Treatment Plan" : c}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs text-pk-text-muted mb-1">Item Name *</label>
              <input
                required
                value={newItem.itemName}
                onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                className="w-full border border-pk-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                placeholder="Medicine / Procedure..."
              />
            </div>
            {/* Treatment picker */}
            {newItem.category === "TREATMENT" && (
              <div className="col-span-full">
                <label className="block text-xs text-pk-text-muted mb-1">Select Treatment Plan *</label>
                {treatments.length === 0 ? (
                  <p className="text-xs text-amber-600 mt-1">No treatment plans linked to this visit. Add one in the Treatment Plan tab first.</p>
                ) : (
                  <select
                    value={newItem.linkedTreatmentId}
                    onChange={(e) => {
                      const tx = treatments.find(t => t.id === e.target.value);
                      if (!tx) {
                        setNewItem(n => ({ ...n, linkedTreatmentId: "", itemName: "", unitPrice: "0", toothNumber: "" }));
                        return;
                      }
                      const firstTooth = tx.toothNumbers ? tx.toothNumbers.split(",")[0].trim() : "";
                      const outstanding = Math.max(0, tx.cost - (tx.billedAmount ?? 0));
                      setNewItem(n => ({
                        ...n,
                        linkedTreatmentId: tx.id,
                        itemName: tx.description,
                        unitPrice: String(outstanding > 0 ? outstanding : tx.cost),
                        toothNumber: firstTooth,
                      }));
                    }}
                    className="w-full border border-pk-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
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
              <select
                value={newItem.toothNumber}
                onChange={(e) => setNewItem({ ...newItem, toothNumber: e.target.value })}
                className="w-full border border-pk-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
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
            </div>
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Qty</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                className="w-full border border-pk-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Unit Price (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newItem.unitPrice}
                onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
                className="w-full border border-pk-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1">
              <label className="block text-xs text-pk-text-muted mb-1">Notes</label>
              <input
                value={newItem.notes}
                onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                className="w-full border border-pk-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
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
                className="bg-pk-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pk-teal-700 disabled:opacity-50 transition"
              >
                {addingItem ? "Adding..." : "Add"}
              </button>
              {addItemError && (
                <p className="text-xs text-red-600">{addItemError}</p>
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
                                <option key={c} value={c}>{c === "TREATMENT" ? "Treatment Plan" : c}</option>
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
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-red-500 hover:text-red-700 text-xs font-medium"
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
    </div>
  );
}
