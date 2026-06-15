"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { SystemRole } from "@/types";
import { orgApi } from "@/api";

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
  adminOnly: boolean;
}

export interface OnboardingChecklistProps {
  steps: OnboardingStep[];
  role: SystemRole;
  dismissed: boolean;
  canDismiss: boolean;
}

const ADMIN_ROLES: SystemRole[] = ["ADMIN"];

export function OnboardingChecklist({ steps, role, dismissed, canDismiss }: OnboardingChecklistProps) {
  const [isDismissed, setIsDismissed] = useState(dismissed);
  const [isPending, startTransition] = useTransition();

  const isAdmin = ADMIN_ROLES.includes(role);

  const visibleSteps = isAdmin
    ? steps
    : steps.filter((s) => !s.adminOnly);

  const doneCount = visibleSteps.filter((s) => s.done).length;
  const total = visibleSteps.length;
  const allDone = doneCount === total;

  if (isDismissed || allDone) return null;

  const pct = Math.round((doneCount / total) * 100);
  const nextStep = visibleSteps.find((s) => !s.done);

  function handleDismiss() {
    startTransition(async () => {
      try {
        await orgApi.dismissOnboarding();
      } finally {
        setIsDismissed(true);
      }
    });
  }

  return (
    <div className="rounded-xl border border-pk-border bg-pk-surface shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-pk-border flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-pk-text text-sm">Get your clinic ready</p>
          <p className="text-xs text-pk-text-muted mt-0.5">{doneCount} of {total} steps done</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-1.5 w-24 rounded-full bg-pk-surface-sunken overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-pk-text-muted w-8 text-right">{pct}%</span>
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isPending}
              className="text-xs text-pk-text-muted hover:text-pk-text-secondary border border-pk-border rounded-md px-2.5 py-1 transition disabled:opacity-50"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-pk-border">
        {visibleSteps.map((step, idx) => {
          const isNext = step.id === nextStep?.id;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-4 px-5 py-3.5 transition ${isNext ? "bg-pk-surface-raised" : ""}`}
            >
              <div className="flex-shrink-0">
                {step.done ? (
                  <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-teal-700" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${isNext ? "bg-pk-teal-100 text-pk-teal-700" : "bg-pk-surface-sunken text-pk-text-muted"}`}>
                    {idx + 1}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm ${step.done ? "line-through text-pk-text-muted" : isNext ? "font-medium text-pk-text" : "text-pk-text-secondary"}`}>
                  {step.label}
                </p>
                {!step.done && (
                  <p className="text-xs text-pk-text-muted mt-0.5 truncate">{step.description}</p>
                )}
              </div>

              {!step.done && (
                <Link
                  href={step.href}
                  className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border transition ${
                    isNext
                      ? "bg-pk-teal-600 text-white border-pk-teal-600 hover:bg-pk-teal-700"
                      : "text-pk-text-muted border-pk-border hover:bg-pk-surface-raised"
                  }`}
                >
                  {isNext ? "Start" : "Go"}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
