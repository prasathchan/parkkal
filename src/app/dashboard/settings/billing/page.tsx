"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  trialing:  { label: "Free trial",          color: "text-pk-teal-700 bg-pk-teal-50 border-pk-teal-200" },
  active:    { label: "Active",               color: "text-pk-success-text bg-pk-success-fill border-pk-success-border" },
  past_due:  { label: "Payment overdue",      color: "text-pk-warning-text bg-pk-warning-fill border-pk-warning-border" },
  cancelled: { label: "Cancelled",            color: "text-pk-text-secondary bg-pk-surface-raised border-pk-border" },
  expired:   { label: "Expired — read-only",  color: "text-pk-danger-text bg-pk-danger-fill border-pk-danger-border" },
};

function BillingPageInner() {
  const searchParams    = useSearchParams();
  const upgraded        = searchParams.get("upgraded") === "1";
  const cancelled       = searchParams.get("cancelled") === "1";

  const [sub,           setSub]          = useState<Subscription | null>(null);
  const [plans,         setPlans]         = useState<Plan[]>([]);
  const [plansError,    setPlansError]    = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [upgrading,     setUpgrading]     = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

  const startCheckout = useCallback(async (planId: string) => {
    setUpgrading(planId);
    setCheckoutError("");
    try {
      const res  = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setCheckoutError(data.error ?? "Could not start checkout. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setCheckoutError("Something went wrong. Please try again.");
    } finally {
      setUpgrading(null);
    }
  }, []);

  useEffect(() => {
    fetch("/api/org/subscription")
      .then((r) => r.json() as Promise<{ subscription: Subscription | null }>)
      .then((d) => setSub(d.subscription ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch("/api/plans")
      .then((r) => r.json() as Promise<{ plans: Plan[] }>)
      .then((d) => setPlans(d.plans ?? []))
      .catch(() => setPlansError(true));
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

        {upgraded && (
          <div className="bg-pk-success-fill border border-pk-success-border rounded-pk-lg px-4 py-3 text-sm text-pk-success-text flex items-center gap-2">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Subscription updated successfully! Your new plan will be active within a few minutes.
          </div>
        )}
        {cancelled && (
          <div className="bg-pk-warning-fill border border-pk-warning-border rounded-pk-lg px-4 py-3 text-sm text-pk-warning-text">
            Checkout was cancelled. No changes were made to your subscription.
          </div>
        )}

        {loading ? (
          <div className="bg-pk-surface rounded-pk-lg border border-pk-border p-8 text-center text-pk-text-muted text-sm">Loading…</div>
        ) : sub ? (
          <>
            {/* Current plan card */}
            <div className="bg-pk-surface rounded-pk-lg border border-pk-border p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-pk-text">Current plan</h2>
                  <p className="text-xs text-pk-text-muted mt-0.5">Your organisation&apos;s active subscription.</p>
                </div>
                {statusInfo && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-pk-surface-raised rounded-pk-sm p-4">
                  <p className="text-xs text-pk-text-muted mb-1">Plan</p>
                  <p className="font-bold text-pk-text text-lg">{sub.planName}</p>
                </div>
                <div className="bg-pk-surface-raised rounded-pk-sm p-4">
                  <p className="text-xs text-pk-text-muted mb-1">Monthly price</p>
                  <p className="font-bold text-pk-text text-lg">
                    {sub.priceMonthly === 0 ? "Free" : `₹${sub.priceMonthly.toLocaleString("en-IN")}`}
                  </p>
                </div>
                <div className="bg-pk-surface-raised rounded-pk-sm p-4">
                  <p className="text-xs text-pk-text-muted mb-1">
                    {sub.status === "trialing" ? "Trial ends" : "Renews"}
                  </p>
                  <p className={`font-bold text-lg ${sub.isReadOnly ? "text-pk-danger-text" : "text-pk-text"}`}>
                    {endDate
                      ? new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                    {sub.daysRemaining !== null && (
                      <span className={`block text-xs font-normal mt-0.5 ${sub.daysRemaining < 0 ? "text-pk-danger-text" : sub.daysRemaining <= 7 ? "text-pk-warning-text" : "text-pk-text-muted"}`}>
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
                <div className="mt-4 p-4 bg-pk-danger-fill border border-pk-danger-border rounded-pk-sm text-sm text-pk-danger-text">
                  Your subscription has expired. Your data is safe and visible, but you cannot create or edit records until you upgrade.
                </div>
              )}
            </div>

            {/* Upgrade / contact section */}
            <div className="bg-pk-surface rounded-pk-lg border border-pk-border p-5">
              <h2 className="font-semibold text-pk-text mb-1">Upgrade or renew</h2>
              <p className="text-sm text-pk-text-muted mb-4">
                Select a plan below to upgrade online, or contact us if you need a custom quote or want to pay via bank transfer.
              </p>
              <a
                href="mailto:support@parkkal.com?subject=Subscription%20upgrade"
                className="inline-flex items-center gap-2 border border-pk-border-strong text-pk-text-secondary px-4 py-2 rounded-pk-sm text-sm font-medium hover:bg-pk-surface-raised transition"
              >
                Contact support
              </a>
            </div>

            {/* Checkout error */}
            {checkoutError && (
              <div className="rounded-pk-lg border border-pk-danger-border bg-pk-danger-fill px-4 py-3 text-sm text-pk-danger-text flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <span>{checkoutError}</span>
              </div>
            )}

            {/* Available plans */}
            {plansError && (
              <div className="rounded-pk-lg border border-pk-border bg-pk-surface-raised px-4 py-3 text-sm text-pk-text-muted">
                Could not load available plans. Please refresh the page or{" "}
                <a href="mailto:support@parkkal.com" className="underline">contact support</a>.
              </div>
            )}
            {!plansError && plans.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-pk-text text-sm">Available plans</h2>
                {plans.filter((p) => p.isActive && p.slug !== "trial").map((plan) => {
                  const features = (() => { try { return JSON.parse(plan.features) as string[]; } catch { return []; } })();
                  const isCurrent = plan.slug === sub.planSlug;
                  return (
                    <div key={plan.id} className={`bg-pk-surface rounded-pk-lg border p-5 ${isCurrent ? "border-pk-teal-400 ring-1 ring-pk-teal-400" : "border-pk-border"}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-pk-text">{plan.name}</h3>
                            {isCurrent && <span className="text-xs bg-pk-teal-100 text-pk-teal-700 px-2 py-0.5 rounded-full font-medium">Current</span>}
                          </div>
                          <p className="text-xs text-pk-text-muted mt-0.5">{plan.description}</p>
                          <p className="text-xs text-pk-text-muted mt-1">
                            {plan.maxDoctors ?? "Unlimited"} doctors · {plan.maxStaff ?? "Unlimited"} staff
                          </p>
                          {features.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {features.map((f) => (
                                <span key={f} className="text-xs bg-pk-surface-sunken text-pk-text-secondary px-2 py-0.5 rounded">{f}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 ml-4 flex flex-col items-end gap-2">
                          <div>
                            <p className="text-2xl font-bold text-pk-text">₹{plan.priceMonthly.toLocaleString("en-IN")}</p>
                            <p className="text-xs text-pk-text-muted">/month</p>
                          </div>
                          {!isCurrent && plan.priceMonthly > 0 && (
                            <button
                              onClick={() => startCheckout(plan.id)}
                              disabled={upgrading === plan.id}
                              className="inline-flex items-center gap-1.5 bg-pk-teal-600 hover:bg-pk-teal-700 disabled:bg-pk-teal-400 text-white text-xs font-semibold px-3 py-1.5 rounded-pk-sm transition"
                            >
                              {upgrading === plan.id ? "Redirecting…" : "Upgrade →"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="bg-pk-surface rounded-pk-lg border border-pk-border p-8 text-center">
            <p className="text-pk-text-muted text-sm">No subscription found. Please contact support.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingPageInner />
    </Suspense>
  );
}
