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
  trialing:  "bg-blue-100 text-blue-700",
  active:    "bg-green-100 text-green-700",
  past_due:  "bg-yellow-100 text-yellow-700",
  cancelled: "bg-slate-100 text-slate-600",
  expired:   "bg-red-100 text-red-700",
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
        <h1 className="text-xl font-bold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">All organisations and their subscription status.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total orgs",     value: subs.length },
          { label: "Trialing",       value: trialing },
          { label: "Active (paid)",  value: active },
          { label: "MRR (₹)",        value: `₹${mrr.toLocaleString("en-IN")}` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">All subscriptions</h2>
          <Link href="/superadmin/subscriptions" className="text-xs text-blue-600 hover:underline">Manage →</Link>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Organisation</th>
                  <th className="px-5 py-3 text-left font-medium">Plan</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Days left</th>
                  <th className="px-5 py-3 text-right font-medium">Signed up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subs.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{s.orgName}</p>
                      {s.orgEmail && <p className="text-xs text-slate-400">{s.orgEmail}</p>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{s.planName}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[s.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {s.daysRemaining !== null ? (
                        <span className={s.daysRemaining < 0 ? "text-red-600 font-medium" : s.daysRemaining <= 7 ? "text-yellow-600" : ""}>
                          {s.daysRemaining < 0 ? `${Math.abs(s.daysRemaining)}d ago` : `${s.daysRemaining}d`}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500 text-xs">
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
