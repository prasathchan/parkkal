"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";

interface Subscription {
  status: string;
  planName: string;
  planSlug: string;
  priceMonthly: number;
  trialEndAt: number | null;
  currentPeriodEnd: number | null;
  daysRemaining: number | null;
  isReadOnly: boolean;
  isActive: boolean;
  notes: string | null;
}

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

const STATUS_COPY: Record<string, { label: string; color: string }> = {
  trialing:  { label: "Free trial",          color: "text-blue-700 bg-blue-50 border-blue-200" },
  active:    { label: "Active",               color: "text-green-700 bg-green-50 border-green-200" },
  past_due:  { label: "Payment overdue",      color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  cancelled: { label: "Cancelled",            color: "text-slate-600 bg-slate-50 border-slate-200" },
  expired:   { label: "Expired — read-only",  color: "text-red-700 bg-red-50 border-red-200" },
};

export default function BillingPage() {
  const [sub, setSub]     = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/org/subscription").then((r) => r.json() as Promise<{ subscription: Subscription | null }>),
      fetch("/api/superadmin/plans").catch(() => ({ json: () => ({ plans: [] }) })),
    ]).then(([subData]) => {
      setSub(subData.subscription ?? null);
    }).finally(() => setLoading(false));

    // Load public plans from a public endpoint
    fetch("/api/plans").then((r) => r.json() as Promise<{ plans: Plan[] }>).then((d) => setPlans(d.plans ?? [])).catch(() => {});
  }, []);

  const statusInfo = sub ? (STATUS_COPY[sub.status] ?? STATUS_COPY["expired"]) : null;

  const endDate = sub
    ? (sub.status === "trialing" ? sub.trialEndAt : sub.currentPeriodEnd)
    : null;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Billing & Subscription"
        breadcrumb={[{ label: "Dashboard" }, { label: "Settings", href: "/dashboard/settings" }, { label: "Billing" }]}
      />
      <main id="main-content" className="flex-1 p-6 max-w-3xl space-y-6">

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : sub ? (
          <>
            {/* Current plan card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-slate-900">Current plan</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Your organisation&apos;s active subscription.</p>
                </div>
                {statusInfo && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-400 mb-1">Plan</p>
                  <p className="font-bold text-slate-900 text-lg">{sub.planName}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-400 mb-1">Monthly price</p>
                  <p className="font-bold text-slate-900 text-lg">
                    {sub.priceMonthly === 0 ? "Free" : `₹${sub.priceMonthly.toLocaleString("en-IN")}`}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-400 mb-1">
                    {sub.status === "trialing" ? "Trial ends" : "Renews"}
                  </p>
                  <p className={`font-bold text-lg ${sub.isReadOnly ? "text-red-700" : "text-slate-900"}`}>
                    {endDate
                      ? new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                    {sub.daysRemaining !== null && (
                      <span className={`block text-xs font-normal mt-0.5 ${sub.daysRemaining < 0 ? "text-red-500" : sub.daysRemaining <= 7 ? "text-yellow-600" : "text-slate-400"}`}>
                        {sub.daysRemaining < 0
                          ? `Expired ${Math.abs(sub.daysRemaining)} days ago`
                          : sub.daysRemaining === 0
                          ? "Expires today"
                          : `${sub.daysRemaining} days remaining`}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {sub.isReadOnly && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  Your subscription has expired. Your data is safe and visible, but you cannot create or edit records until you upgrade.
                </div>
              )}
            </div>

            {/* Upgrade / contact section */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-1">Upgrade or renew</h2>
              <p className="text-sm text-slate-500 mb-4">
                To upgrade, renew, or apply a coupon code — contact us and we&apos;ll activate your plan manually.
              </p>
              <a
                href="mailto:support@parkkal.com?subject=Subscription%20upgrade"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                Contact us to upgrade
              </a>
            </div>

            {/* Available plans */}
            {plans.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-slate-900 text-sm">Available plans</h2>
                {plans.filter((p) => p.isActive && p.slug !== "trial").map((plan) => {
                  const features = (() => { try { return JSON.parse(plan.features) as string[]; } catch { return []; } })();
                  const isCurrent = plan.slug === sub.planSlug;
                  return (
                    <div key={plan.id} className={`bg-white rounded-xl border p-5 ${isCurrent ? "border-blue-400 ring-1 ring-blue-400" : "border-slate-200"}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                            {isCurrent && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Current</span>}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {plan.maxDoctors ?? "Unlimited"} doctors · {plan.maxStaff ?? "Unlimited"} staff
                          </p>
                          {features.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {features.map((f) => (
                                <span key={f} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{f}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="text-2xl font-bold text-slate-900">₹{plan.priceMonthly.toLocaleString("en-IN")}</p>
                          <p className="text-xs text-slate-400">/month</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-slate-500 text-sm">No subscription found. Please contact support.</p>
          </div>
        )}
      </main>
    </div>
  );
}
