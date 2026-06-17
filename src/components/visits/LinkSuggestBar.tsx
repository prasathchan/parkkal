"use client";

import { useState, useEffect } from "react";
import { treatmentsApi } from "@/api";
import type { Treatment } from "@/components/visits/types";
import { TREATMENT_STATUS } from "@/constants/treatment";

interface Props {
  visitId: string;
  patientId: string;
  alreadyLinkedIds: Set<string>;
  onLinked: () => Promise<void>;
}

export function LinkSuggestBar({ visitId, patientId, alreadyLinkedIds, onLinked }: Props) {
  const [plans, setPlans] = useState<Treatment[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [linking, setLinking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check sessionStorage on mount — if already dismissed, stay hidden
  useEffect(() => {
    if (typeof window !== "undefined") {
      const key = `pk_link_suggest_${visitId}`;
      if (sessionStorage.getItem(key)) {
        setDismissed(true);
        return;
      }
    }
    // Fetch unlinked PLANNED/IN_PROGRESS plans
    treatmentsApi.list({ patientId })
      .then(({ treatments }) => {
        const unlinked = treatments.filter(
          (t) =>
            (t.status === TREATMENT_STATUS.PLANNED || t.status === TREATMENT_STATUS.IN_PROGRESS) &&
            !alreadyLinkedIds.has(t.id),
        );
        setPlans(unlinked);
        setChecked(new Set(unlinked.map((t) => t.id)));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId, patientId]);

  function dismiss() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`pk_link_suggest_${visitId}`, "1");
    }
    setDismissed(true);
  }

  async function handleLink() {
    const toLink = plans.filter((p) => checked.has(p.id));
    if (toLink.length === 0) return;
    setLinking(true);
    try {
      for (const plan of toLink) {
        await treatmentsApi.forVisit.link(visitId, { treatmentId: plan.id });
      }
      await onLinked();
    } catch {
      // silently fail — main page will show errors if needed
    } finally {
      setLinking(false);
    }
    dismiss();
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (dismissed || plans.length === 0) return null;

  const checkedCount = plans.filter((p) => checked.has(p.id)).length;

  return (
    <div className="rounded-pk-lg border border-teal-200 bg-teal-50 px-4 py-3">
      <p className="text-sm font-semibold text-pk-teal-700 mb-2">
        {plans.length} treatment plan{plans.length !== 1 ? "s" : ""} not linked to this visit
      </p>
      <ul className="space-y-1.5 mb-3">
        {plans.map((plan) => (
          <li key={plan.id} className="flex items-center gap-2">
            <input
              id={`link-suggest-${plan.id}`}
              type="checkbox"
              checked={checked.has(plan.id)}
              onChange={() => toggleCheck(plan.id)}
              className="h-3.5 w-3.5 rounded border-pk-border text-pk-teal-600 focus:ring-pk-teal-500"
            />
            <label htmlFor={`link-suggest-${plan.id}`} className="flex items-center gap-2 text-sm text-pk-text cursor-pointer">
              <span className="font-medium">{plan.description}</span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  plan.status === TREATMENT_STATUS.IN_PROGRESS
                    ? "bg-teal-100 text-pk-teal-700"
                    : "bg-pk-surface-sunken text-pk-text-muted"
                }`}
              >
                {plan.status === TREATMENT_STATUS.IN_PROGRESS ? "In Progress" : "Planned"}
              </span>
              {plan.toothNumbers &&
                plan.toothNumbers
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .map((t) => (
                    <span
                      key={t}
                      className="inline-block bg-teal-100 text-pk-teal-700 text-[10px] px-1.5 py-0.5 rounded font-mono"
                    >
                      {t}
                    </span>
                  ))}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={linking || checkedCount === 0}
          onClick={handleLink}
          className="bg-pk-teal-600 text-white text-xs font-medium px-3 py-1.5 rounded-pk-sm hover:bg-pk-teal-700 disabled:opacity-50 transition"
        >
          {linking ? "Linking…" : `Link selected (${checkedCount})`}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-pk-text-muted hover:text-pk-text-secondary transition"
        >
          Dismiss for this visit
        </button>
      </div>
    </div>
  );
}
