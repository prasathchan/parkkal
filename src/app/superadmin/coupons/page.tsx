"use client";

import { useEffect, useState } from "react";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: "percent" | "amount";
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  validFrom: number | null;
  validUntil: number | null;
  planSlug: string | null;
  isActive: number;
  createdAt: number;
}

const blankForm = {
  code: "", description: "", discountType: "percent" as "percent" | "amount",
  discountValue: 10, maxUses: "", validFrom: "", validUntil: "", planSlug: "", isActive: true,
};

export default function CouponsPage() {
  const [coupons, setCoupons]     = useState<Coupon[]>([]);
  const [showNew, setShowNew]     = useState(false);
  const [form, setForm]           = useState({ ...blankForm });
  const [creating, setCreating]   = useState(false);
  const [msg, setMsg]             = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const r = await fetch("/api/superadmin/coupons");
    const d = await r.json() as { coupons: Coupon[] };
    setCoupons(d.coupons ?? []);
  }

  async function createCoupon() {
    setCreating(true);
    setMsg("");
    try {
      await fetch("/api/superadmin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code:          form.code.toUpperCase().trim(),
          description:   form.description || undefined,
          discountType:  form.discountType,
          discountValue: Number(form.discountValue),
          maxUses:       form.maxUses ? Number(form.maxUses) : null,
          validFrom:     form.validFrom ? new Date(form.validFrom).getTime() : undefined,
          validUntil:    form.validUntil ? new Date(form.validUntil).getTime() : undefined,
          planSlug:      form.planSlug || null,
          isActive:      form.isActive,
        }),
      });
      setMsg("Coupon created.");
      setForm({ ...blankForm });
      setShowNew(false);
      await load();
    } finally { setCreating(false); }
  }

  async function toggleActive(coupon: Coupon) {
    await fetch(`/api/superadmin/coupons/${coupon.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !coupon.isActive }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-pk-text">Coupon Codes</h1>
          <p className="text-sm text-pk-text-muted mt-0.5">Create and manage discount codes for customers.</p>
        </div>
        <button onClick={() => { setShowNew(true); setMsg(""); }} className="bg-pk-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pk-teal-700 transition">
          + New coupon
        </button>
      </div>

      {msg && <p className="text-sm text-pk-success-text bg-pk-success-fill border border-pk-success-border rounded-lg px-4 py-2">{msg}</p>}

      {showNew && (
        <div className="bg-white rounded-xl border border-pk-teal-200 p-5 space-y-4">
          <h2 className="font-semibold text-pk-text text-sm">New coupon</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Code *</label>
              <input type="text" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="WELCOME30" className="w-full border border-pk-border-strong rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
            </div>
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Description</label>
              <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="30% off first month" className="w-full border border-pk-border-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
            </div>
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Discount type</label>
              <select value={form.discountType} onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as "percent" | "amount" }))}
                className="w-full border border-pk-border-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                <option value="percent">Percentage (%)</option>
                <option value="amount">Fixed amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">
                Discount value ({form.discountType === "percent" ? "%" : "₹"})
              </label>
              <input type="number" min={0} value={form.discountValue} onChange={(e) => setForm((f) => ({ ...f, discountValue: Number(e.target.value) }))}
                className="w-full border border-pk-border-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
            </div>
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Max uses (blank = unlimited)</label>
              <input type="number" min={1} value={form.maxUses} onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                placeholder="100" className="w-full border border-pk-border-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
            </div>
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Applies to plan (blank = any)</label>
              <input type="text" value={form.planSlug} onChange={(e) => setForm((f) => ({ ...f, planSlug: e.target.value }))}
                placeholder="clinic" className="w-full border border-pk-border-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
            </div>
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Valid from (optional)</label>
              <input type="date" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                className="w-full border border-pk-border-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
            </div>
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Valid until (optional)</label>
              <input type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                className="w-full border border-pk-border-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createCoupon} disabled={creating || !form.code} className="bg-pk-teal-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-pk-teal-700 disabled:opacity-50 transition">
              {creating ? "Creating…" : "Create coupon"}
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-1.5 rounded-lg text-sm border border-pk-border text-pk-text-secondary hover:bg-pk-surface-raised transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-pk-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-pk-surface-raised text-xs text-pk-text-muted uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Code</th>
                <th className="px-5 py-3 text-left font-medium">Discount</th>
                <th className="px-5 py-3 text-left font-medium">Usage</th>
                <th className="px-5 py-3 text-left font-medium">Expires</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pk-border">
              {coupons.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-pk-text-muted text-sm">No coupons yet.</td></tr>
              ) : coupons.map((c) => (
                <tr key={c.id} className="hover:bg-pk-surface-raised">
                  <td className="px-5 py-3">
                    <code className="font-mono font-bold text-pk-text">{c.code}</code>
                    {c.description && <p className="text-xs text-pk-text-muted mt-0.5">{c.description}</p>}
                  </td>
                  <td className="px-5 py-3 font-medium text-pk-text-secondary">
                    {c.discountType === "percent" ? `${c.discountValue}%` : `₹${c.discountValue}`}
                    {c.planSlug && <span className="ml-1 text-xs text-pk-text-muted">({c.planSlug} only)</span>}
                  </td>
                  <td className="px-5 py-3 text-pk-text-secondary">
                    {c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : " / ∞"}
                  </td>
                  <td className="px-5 py-3 text-pk-text-muted text-xs">
                    {c.validUntil ? new Date(c.validUntil).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? "bg-pk-success-fill text-pk-success-text" : "bg-pk-surface-sunken text-pk-text-muted"}`}>
                      {c.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => toggleActive(c)} className="text-xs text-pk-teal-600 hover:underline">
                      {c.isActive ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
