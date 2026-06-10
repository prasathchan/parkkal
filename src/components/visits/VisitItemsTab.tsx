"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { CATEGORIES, DEFAULT_NEW_ITEM, type NewItemState, type Treatment, type VisitItem } from "./types";
import { visitsApi, ApiError } from "@/api";

interface Props {
  visitId: string;
  visitStatus: string;
  items: VisitItem[];
  treatments: Treatment[];
  prefillItem?: NewItemState | null;
  onRefresh: () => Promise<void>;
  onPageError: (msg: string) => void;
}

export function VisitItemsTab({ visitId, visitStatus, items, treatments, prefillItem, onRefresh, onPageError }: Props) {
  const [newItem, setNewItem] = useState<NewItemState>(prefillItem ?? DEFAULT_NEW_ITEM);
  const [addingItem, setAddingItem] = useState(false);
  const [addItemError, setAddItemError] = useState("");

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

  return (
    <div className="space-y-5">
      {/* Add Item Form */}
      {visitStatus !== "CANCELLED" && (
        <form onSubmit={handleAddItem} className="bg-slate-50 rounded-lg p-4">
          {visitStatus === "COMPLETED" && (
            <p className="text-xs text-amber-600 mb-2">⚠️ Visit is completed — items added will update billing.</p>
          )}
          <p className="text-sm font-semibold text-slate-700 mb-3">Add Item</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Category</label>
              <select
                value={newItem.category}
                onChange={(e) => {
                  const cat = e.target.value;
                  setNewItem({ itemName: "", category: cat, toothNumber: "", quantity: "1", unitPrice: "0", notes: "", linkedTreatmentId: "" });
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c === "TREATMENT" ? "Treatment Plan" : c}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Item Name *</label>
              <input
                required
                value={newItem.itemName}
                onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Medicine / Procedure..."
              />
            </div>
            {/* Treatment picker */}
            {newItem.category === "TREATMENT" && (
              <div className="col-span-full">
                <label className="block text-xs text-slate-500 mb-1">Select Treatment Plan *</label>
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
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <p className="text-xs text-slate-400 mt-1">
                    Estimated cost pre-filled. Edit the Unit Price below to match what the patient agreed to pay.
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Tooth #</label>
              <select
                value={newItem.toothNumber}
                onChange={(e) => setNewItem({ ...newItem, toothNumber: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-xs text-slate-500 mb-1">Qty</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Unit Price (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newItem.unitPrice}
                onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Notes</label>
              <input
                value={newItem.notes}
                onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional notes..."
              />
            </div>
            <div className="pt-5">
              <p className="text-sm font-semibold text-slate-700">
                = {formatCurrency(Number(newItem.quantity) * Number(newItem.unitPrice))}
              </p>
            </div>
            <div className="pt-5 flex items-center gap-3">
              <button
                type="submit"
                disabled={addingItem}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
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
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Item</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Category</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Tooth</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">Qty</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">Unit Price</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">Amount</th>
              {visitStatus !== "CANCELLED" && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-6 text-slate-400">No items added yet</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-900">{item.itemName}</div>
                    {item.notes && <div className="text-xs text-slate-400">{item.notes}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{item.category}</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{item.toothNumber || "—"}</td>
                  <td className="px-3 py-2.5 text-right">{item.quantity}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(item.amount)}</td>
                  {visitStatus !== "CANCELLED" && (
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colSpan={5} className="px-3 py-2 text-right font-semibold text-slate-700">Subtotal</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">
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
