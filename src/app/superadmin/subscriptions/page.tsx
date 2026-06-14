"use client";

import { useEffect, useState } from "react";

interface SubRow {
  id: string;
  orgId: string;
  orgName: string;
  orgEmail: string | null;
  planName: string;
  planSlug: string;
  priceMonthly: number;
  status: string;
  daysRemaining: number | null;
  notes: string | null;
  createdAt: number;
}

const STATUS_BADGE: Record<string, string> = {
  trialing:  "bg-pk-teal-100 text-pk-teal-700",
  active:    "bg-pk-success-fill text-pk-success-text",
  past_due:  "bg-pk-warning-fill text-pk-warning-text",
  cancelled: "bg-pk-surface-sunken text-pk-text-secondary",
  expired:   "bg-pk-danger-fill text-pk-danger-text",
};

const PLANS = ["solo", "clinic", "enterprise"];

export default function SubscriptionsPage() {
  const [subs, setSubs]         = useState<SubRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<{
    id: string; planSlug: string; months: number; notes: string;
  } | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/superadmin/subscriptions");
    const d = await r.json() as { subscriptions: SubRow[] };
    setSubs(d.subscriptions ?? []);
    setLoading(false);
  }

  async function activate() {
    if (!activeForm) return;
    setActivating(activeForm.id);
    setMsg("");
    try {
      await fetch(`/api/superadmin/subscriptions/${activeForm.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug: activeForm.planSlug,
          months:   activeForm.months,
          notes:    activeForm.notes || undefined,
        }),
      });
      setMsg(`Activated ${activeForm.planSlug} for ${activeForm.months} month(s).`);
      setActiveForm(null);
      await load();
    } finally { setActivating(null); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-pk-text">Subscriptions</h1>
        <p className="text-sm text-pk-text-muted mt-0.5">View all organisations. Manually activate cash-paying clinics here.</p>
      </div>

      {msg && <p className="text-sm text-pk-success-text bg-pk-success-fill border border-pk-success-border rounded-lg px-4 py-2">{msg}</p>}

      {activeForm && (
        <div className="bg-white rounded-xl border border-pk-teal-200 p-5 space-y-4">
          <h2 className="font-semibold text-pk-text text-sm">Manually activate subscription</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Plan</label>
              <select value={activeForm.planSlug} onChange={(e) => setActiveForm((f) => f ? { ...f, planSlug: e.target.value } : f)}
                className="w-full border border-pk-border-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                {PLANS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Months</label>
              <input type="number" min={1} max={24} value={activeForm.months}
                onChange={(e) => setActiveForm((f) => f ? { ...f, months: Number(e.target.value) } : f)}
                className="w-full border border-pk-border-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
            </div>
            <div>
              <label className="block text-xs text-pk-text-muted mb-1">Notes (optional)</label>
              <input type="text" value={activeForm.notes} placeholder="Cash payment received"
                onChange={(e) => setActiveForm((f) => f ? { ...f, notes: e.target.value } : f)}
                className="w-full border border-pk-border-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={activate} disabled={!!activating}
              className="bg-pk-success text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-pk-success disabled:opacity-50 transition">
              {activating ? "Activating…" : "Activate"}
            </button>
            <button onClick={() => setActiveForm(null)}
              className="px-4 py-1.5 rounded-lg text-sm border border-pk-border text-pk-text-secondary hover:bg-pk-surface-raised transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-pk-border overflow-hidden">
        {loading ? (
          <p className="px-5 py-8 text-center text-pk-text-muted text-sm">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-pk-surface-raised text-xs text-pk-text-muted uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Organisation</th>
                  <th className="px-5 py-3 text-left font-medium">Plan</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Days left</th>
                  <th className="px-5 py-3 text-left font-medium">Notes</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pk-border">
                {subs.map((s) => (
                  <tr key={s.id} className="hover:bg-pk-surface-raised">
                    <td className="px-5 py-3">
                      <p className="font-medium text-pk-text">{s.orgName}</p>
                      {s.orgEmail && <p className="text-xs text-pk-text-muted">{s.orgEmail}</p>}
                    </td>
                    <td className="px-5 py-3 text-pk-text-secondary">{s.planName} <span className="text-xs text-pk-text-muted">₹{s.priceMonthly}/mo</span></td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[s.status] ?? "bg-pk-surface-sunken text-pk-text-secondary"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {s.daysRemaining !== null ? (
                        <span className={s.daysRemaining < 0 ? "text-pk-danger-text font-medium" : s.daysRemaining <= 7 ? "text-pk-warning-text" : "text-pk-text-secondary"}>
                          {s.daysRemaining < 0 ? `${Math.abs(s.daysRemaining)}d overdue` : `${s.daysRemaining}d`}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-pk-text-muted max-w-[200px] truncate">{s.notes ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setActiveForm({ id: s.id, planSlug: s.planSlug === "trial" ? "solo" : s.planSlug, months: 1, notes: "" })}
                        className="text-xs bg-pk-success-fill text-pk-success-text border border-pk-success-border px-2.5 py-1 rounded-lg hover:bg-pk-success-fill transition"
                      >
                        Activate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
