"use client";

import { useState, useEffect } from "react";
import { treatmentsApi } from "@/api";
import type { Treatment } from "@/components/visits/types";
import { TREATMENT_STATUS } from "@/constants/treatment";

interface Props {
  visitId: string;
  patientId: string;
  alreadyLinkedIds: Set<string>;
  onLink: (plans: Treatment[]) => Promise<void>;
  onLinkOnly: (plans: Treatment[]) => Promise<void>;
}

export function LinkSuggestBar({ visitId, patientId, alreadyLinkedIds, onLink, onLinkOnly }: Props) {
  const [plans, setPlans] = useState<Treatment[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [linking, setLinking] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (sessionStorage.getItem(`pk_link_suggest_${visitId}`)) return;
    }
    treatmentsApi.list({ patientId })
      .then(({ treatments }) => {
        const unlinked = treatments.filter(
          (t) =>
            (t.status === TREATMENT_STATUS.PLANNED || t.status === TREATMENT_STATUS.IN_PROGRESS) &&
            !alreadyLinkedIds.has(t.id),
        );
        if (unlinked.length > 0) {
          setPlans(unlinked);
          setChecked(new Set(unlinked.map((t) => t.id)));
          setOpen(true);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId, patientId]);

  function close() {
    setOpen(false);
  }

  function dismiss() {
    if (typeof window !== "undefined") sessionStorage.setItem(`pk_link_suggest_${visitId}`, "1");
    setOpen(false);
  }

  async function handleLink(withBill: boolean) {
    const toLink = plans.filter((p) => checked.has(p.id));
    if (toLink.length === 0) return;
    setLinking(true);
    try {
      if (withBill) {
        await onLink(toLink);
      } else {
        await onLinkOnly(toLink);
      }
    } finally {
      setLinking(false);
    }
    dismiss();
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (checked.size === plans.length) setChecked(new Set());
    else setChecked(new Set(plans.map((p) => p.id)));
  }

  if (!open || plans.length === 0) return null;

  const checkedCount = plans.filter((p) => checked.has(p.id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-pk-surface rounded-pk-xl shadow-pk-e3 w-full max-w-lg flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-pk-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-pk-text">Link Treatment Plans</h2>
            <p className="text-xs text-pk-text-muted mt-0.5">
              {plans.length} existing plan{plans.length !== 1 ? "s" : ""} found for this patient.
              Linking auto-creates a bill item and updates the chart for in-progress treatments.
            </p>
          </div>
          <button onClick={close} aria-label="Close" className="text-pk-text-muted hover:text-pk-text-secondary text-xl leading-none ml-4">&times;</button>
        </div>

        {/* Select all row */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-pk-border bg-pk-surface-raised flex-shrink-0">
          <input
            type="checkbox"
            id="link-all"
            checked={checked.size === plans.length && plans.length > 0}
            onChange={toggleAll}
            className="h-3.5 w-3.5 rounded border-pk-border text-pk-teal-600 focus:ring-pk-teal-500"
          />
          <label htmlFor="link-all" className="text-xs font-medium text-pk-text-secondary cursor-pointer">
            Select all ({plans.length})
          </label>
        </div>

        {/* Plan list */}
        <ul className="overflow-y-auto flex-1 divide-y divide-pk-border">
          {plans.map((plan) => {
            const outstanding = Math.max(0, plan.cost - (plan.billedAmount ?? 0));
            const teeth = plan.toothNumbers?.split(",").map((t) => t.trim()).filter(Boolean) ?? [];
            return (
              <li key={plan.id} className={`flex items-start gap-3 px-5 py-3.5 transition ${checked.has(plan.id) ? "bg-pk-teal-50/40" : ""}`}>
                <input
                  type="checkbox"
                  id={`link-${plan.id}`}
                  checked={checked.has(plan.id)}
                  onChange={() => toggleCheck(plan.id)}
                  className="h-4 w-4 mt-0.5 rounded border-pk-border text-pk-teal-600 focus:ring-pk-teal-500 flex-shrink-0"
                />
                <label htmlFor={`link-${plan.id}`} className="flex-1 min-w-0 cursor-pointer">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-pk-text">{plan.description}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      plan.status === TREATMENT_STATUS.IN_PROGRESS
                        ? "bg-pk-teal-100 text-pk-teal-700"
                        : "bg-pk-surface-sunken text-pk-text-muted"
                    }`}>
                      {plan.status === TREATMENT_STATUS.IN_PROGRESS ? "In Progress" : "Planned"}
                    </span>
                  </div>
                  {plan.procedure && (
                    <p className="text-xs text-pk-text-muted mt-0.5">{plan.procedure}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {teeth.map((t) => (
                      <span key={t} className="inline-block bg-pk-teal-50 text-pk-teal-700 text-[10px] px-1.5 py-0.5 rounded font-mono border border-pk-teal-200">
                        {t}
                      </span>
                    ))}
                    {plan.cost > 0 && (
                      <span className="text-xs text-pk-text-muted ml-auto">
                        {outstanding > 0
                          ? <>Outstanding <span className="font-medium text-pk-text-secondary">₹{outstanding.toLocaleString("en-IN")}</span></>
                          : <span className="text-pk-success-text">Fully paid</span>
                        }
                      </span>
                    )}
                  </div>
                  {plan.status === TREATMENT_STATUS.IN_PROGRESS && teeth.length > 0 && (
                    <p className="text-[10px] text-pk-teal-600 mt-1">
                      ✦ Dental chart will auto-update for {teeth.length === 1 ? `tooth ${teeth[0]}` : `teeth ${teeth.join(", ")}`}
                    </p>
                  )}
                </label>
              </li>
            );
          })}
        </ul>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-5 border-t border-pk-border flex-shrink-0">
          <button
            onClick={dismiss}
            className="text-sm text-pk-text-muted hover:text-pk-text-secondary transition flex-shrink-0"
          >
            Skip for this visit
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={linking || checkedCount === 0}
              onClick={() => handleLink(false)}
              className="border border-pk-border text-pk-text-secondary text-sm font-medium px-4 py-2 rounded-pk-sm hover:bg-pk-surface-raised disabled:opacity-50 transition"
            >
              {linking ? "Linking…" : `Link ${checkedCount} item${checkedCount !== 1 ? "s" : ""}`}
            </button>
            <button
              type="button"
              disabled={linking || checkedCount === 0}
              onClick={() => handleLink(true)}
              className="bg-pk-teal-600 text-white text-sm font-medium px-4 py-2 rounded-pk-sm hover:bg-pk-teal-700 disabled:opacity-50 transition"
            >
              {linking ? "Linking…" : `Link ${checkedCount} item${checkedCount !== 1 ? "s" : ""} & Add to Bill`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
