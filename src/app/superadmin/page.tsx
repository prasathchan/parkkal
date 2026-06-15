"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SubRow {
  id: string;
  orgName: string;
  orgEmail: string | null;
  planName: string;
  planSlug: string;
  priceMonthly: number;
  status: string;
  daysRemaining: number | null;
  createdAt: number;
}

const STATUS_BADGE: Record<string, string> = {
  trialing:  "bg-pk-teal-100 text-pk-teal-700",
  active:    "bg-pk-success-fill text-pk-success-text",
  past_due:  "bg-pk-warning-fill text-pk-warning-text",
  cancelled: "bg-pk-surface-sunken text-pk-text-secondary",
  expired:   "bg-pk-danger-fill text-pk-danger-text",
};

export default function SuperadminOverviewPage() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/superadmin/subscriptions")
      .then((r) => r.json() as Promise<{ subscriptions: SubRow[] }>)
      .then((d) => setSubs(d.subscriptions ?? []))
      .finally(() => setLoading(false));
  }, []);

  const trialing  = subs.filter((s) => s.status === "trialing").length;
  const active    = subs.filter((s) => s.status === "active").length;
  const _expired   = subs.filter((s) => s.status === "expired" || (s.status === "trialing" && (s.daysRemaining ?? 0) < 0)).length;
  const mrr       = subs.filter((s) => s.status === "active").reduce((sum, s) => sum + s.priceMonthly, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-pk-text">Overview</h1>
        <p className="text-sm text-pk-text-muted mt-0.5">All organisations and their subscription status.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total orgs",     value: subs.length },
          { label: "Trialing",       value: trialing },
          { label: "Active (paid)",  value: active },
          { label: "MRR (₹)",        value: `₹${mrr.toLocaleString("en-IN")}` },
        ].map((s) => (
          <div key={s.label} className="bg-pk-surface rounded-xl border border-pk-border p-4">
            <p className="text-xs text-pk-text-muted mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-pk-text">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-pk-surface rounded-xl border border-pk-border overflow-hidden">
        <div className="px-5 py-4 border-b border-pk-border flex items-center justify-between">
          <h2 className="font-semibold text-pk-text text-sm">All subscriptions</h2>
          <Link href="/superadmin/subscriptions" className="text-xs text-pk-teal-600 hover:underline">Manage →</Link>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-sm text-pk-text-muted text-center">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-pk-surface-raised text-xs text-pk-text-muted uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Organisation</th>
                  <th className="px-5 py-3 text-left font-medium">Plan</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Days left</th>
                  <th className="px-5 py-3 text-right font-medium">Signed up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pk-border">
                {subs.map((s) => (
                  <tr key={s.id} className="hover:bg-pk-surface-raised">
                    <td className="px-5 py-3">
                      <p className="font-medium text-pk-text">{s.orgName}</p>
                      {s.orgEmail && <p className="text-xs text-pk-text-muted">{s.orgEmail}</p>}
                    </td>
                    <td className="px-5 py-3 text-pk-text-secondary">{s.planName}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[s.status] ?? "bg-pk-surface-sunken text-pk-text-secondary"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-pk-text-secondary">
                      {s.daysRemaining !== null ? (
                        <span className={s.daysRemaining < 0 ? "text-pk-danger-text font-medium" : s.daysRemaining <= 7 ? "text-pk-warning-text" : ""}>
                          {s.daysRemaining < 0 ? `${Math.abs(s.daysRemaining)}d ago` : `${s.daysRemaining}d`}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-pk-text-muted text-xs">
                      {new Date(s.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
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
