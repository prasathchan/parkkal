"use client";

import { useEffect, useState } from "react";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: number;
  maxDoctors: number | null;
  maxStaff: number | null;
  features: string;
  isActive: number;
  sortOrder: number;
}

export default function PlansPage() {
  const [plans, setPlans]   = useState<Plan[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm]     = useState<Partial<Plan>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState("");

  useEffect(() => { loadPlans(); }, []);

  async function loadPlans() {
    const r = await fetch("/api/superadmin/plans");
    const d = await r.json() as { plans: Plan[] };
    setPlans(d.plans ?? []);
  }

  function startEdit(plan: Plan) {
    setEditing(plan.id);
    setForm({ ...plan });
    setMsg("");
  }

  async function savePlan() {
    if (!editing) return;
    setSaving(true);
    setMsg("");
    try {
      const features = typeof form.features === "string"
        ? (form.features as string).split(",").map((f) => f.trim()).filter(Boolean)
        : form.features;
      await fetch(`/api/superadmin/plans/${editing}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:         form.name,
          description:  form.description,
          priceMonthly: Number(form.priceMonthly),
          maxDoctors:   form.maxDoctors ? Number(form.maxDoctors) : null,
          maxStaff:     form.maxStaff   ? Number(form.maxStaff)   : null,
          features,
          isActive:     form.isActive === 1,
          sortOrder:    Number(form.sortOrder ?? 0),
        }),
      });
      setMsg("Saved.");
      setEditing(null);
      await loadPlans();
    } finally { setSaving(false); }
  }

  const field = (key: keyof Plan, label: string, type = "text") => (
    <div>
      <label className="block text-xs text-pk-text-muted mb-1">{label}</label>
      <input
        type={type}
        value={String(form[key] ?? "")}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-pk-border-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-pk-text">Plans & Pricing</h1>
        <p className="text-sm text-pk-text-muted mt-0.5">Edit plan names, prices, and doctor limits. Changes take effect immediately for new subscriptions.</p>
      </div>

      {msg && <p className="text-sm text-pk-success-text bg-pk-success-fill border border-pk-success-border rounded-lg px-4 py-2">{msg}</p>}

      <div className="space-y-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white rounded-xl border border-pk-border p-5">
            {editing === plan.id ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {field("name", "Plan name")}
                  {field("priceMonthly", "Price / month (₹)", "number")}
                  {field("maxDoctors", "Max doctors (blank = unlimited)", "number")}
                  {field("maxStaff", "Max staff (blank = unlimited)", "number")}
                  {field("sortOrder", "Sort order", "number")}
                </div>
                <div>
                  <label className="block text-xs text-pk-text-muted mb-1">Description</label>
                  <input
                    type="text"
                    value={form.description ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full border border-pk-border-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-pk-text-muted mb-1">Features (comma-separated)</label>
                  <input
                    type="text"
                    value={typeof form.features === "string" ? form.features : JSON.parse(form.features || "[]").join(", ")}
                    onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))}
                    className="w-full border border-pk-border-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-pk-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive === 1}
                      onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked ? 1 : 0 }))}
                      className="rounded"
                    />
                    Active (visible to new signups)
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={savePlan} disabled={saving} className="bg-pk-teal-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-pk-teal-700 disabled:opacity-50 transition">
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                  <button onClick={() => setEditing(null)} className="px-4 py-1.5 rounded-lg text-sm border border-pk-border text-pk-text-secondary hover:bg-pk-surface-raised transition">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-pk-text">{plan.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${plan.isActive ? "bg-pk-success-fill text-pk-success-text" : "bg-pk-surface-sunken text-pk-text-muted"}`}>
                      {plan.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-pk-text-muted">{plan.description}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-pk-text-secondary">
                    <span className="font-bold text-lg text-pk-teal-700">₹{plan.priceMonthly.toLocaleString("en-IN")}<span className="text-xs font-normal text-pk-text-muted">/mo</span></span>
                    <span className="text-xs text-pk-text-muted mt-1">· {plan.maxDoctors ?? "∞"} doctors · {plan.maxStaff ?? "∞"} staff</span>
                  </div>
                </div>
                <button onClick={() => startEdit(plan)} className="text-sm text-pk-teal-600 hover:underline">
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
