"use client";

/**
 * CompleteVisitModal
 *
 * Fires when a doctor clicks "Complete Visit". Batches all treatment status
 * decisions into a single review step so mid-session interruptions never occur.
 *
 * Handles:
 *  - PLANNED treatments with a payment this visit → doctor decides IN_PROGRESS / COMPLETED
 *  - IN_PROGRESS treatments where full payment has been reached → doctor decides COMPLETED / keep
 *  - IN_PROGRESS treatments whose chart teeth changed this visit but have no treatment_start
 *    history entry → includes chart section (L4 fix)
 *
 * On "Confirm & Complete":
 *  1. Applies all treatment status changes via PATCH /api/treatments/[id]
 *  2. If any treatment moved to IN_PROGRESS, saves chart with source='treatment_start'
 *  3. Calls onComplete() which triggers the actual visit completion
 */

import { useState } from "react";
import { treatmentsApi, patientsApi, ApiError } from "@/api";
import type { TreatmentDecision } from "@/api/treatments";
import type { ChartData } from "@/components/ui/ToothChart";
import { ToothChart } from "@/components/ui/ToothChart";
import { ToothChart as ToothSelector } from "@/components/ui/tooth-chart";

interface Props {
  visitId: string;
  patientId: string;
  decisions: TreatmentDecision[];
  currentChartData: ChartData;
  onComplete: () => Promise<void>;
  onCancel: () => void;
}

type StatusChoice = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "keep";

export function CompleteVisitModal({
  visitId,
  patientId,
  decisions,
  currentChartData,
  onComplete,
  onCancel,
}: Props) {
  // Per-treatment status choices
  const [choices, setChoices] = useState<Record<string, StatusChoice>>(() => {
    const init: Record<string, StatusChoice> = {};
    for (const d of decisions) {
      init[d.id] = d.suggestedStatus ?? "keep";
    }
    return init;
  });

  // Chart data for any treatment being moved to IN_PROGRESS that needs a chart entry
  const [chartData, setChartData] = useState<ChartData>(currentChartData);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Which treatments need a chart section (L4: no treatment_start entry yet)
  const needsChartSection = decisions.some(
    (d) => (choices[d.id] === "IN_PROGRESS" || (choices[d.id] === "keep" && d.status === "IN_PROGRESS"))
      && !d.hasChartStartEntry
  );

  async function handleConfirm() {
    setSubmitting(true);
    setError("");

    try {
      // 1. Apply treatment status changes
      for (const d of decisions) {
        const choice = choices[d.id];
        if (choice === "keep") continue;

        const newStatus = choice as "PLANNED" | "IN_PROGRESS" | "COMPLETED";
        if (newStatus !== d.status) {
          await treatmentsApi.update(d.id, { status: newStatus });
        }
      }

      // 2. Save chart with treatment_start source for any treatment moving to IN_PROGRESS
      const inProgressTreatments = decisions.filter(
        (d) => choices[d.id] === "IN_PROGRESS" && !d.hasChartStartEntry
      );

      for (const tx of inProgressTreatments) {
        await patientsApi.saveToothChart(
          patientId,
          chartData as Record<string, unknown>,
          visitId,
          "treatment_start",
          tx.id,
        );
      }

      // 3. For COMPLETED treatments that never had a treatment_start entry (L4)
      const completedWithoutStart = decisions.filter(
        (d) => choices[d.id] === "COMPLETED" && !d.hasChartStartEntry
      );
      for (const tx of completedWithoutStart) {
        await patientsApi.saveToothChart(
          patientId,
          chartData as Record<string, unknown>,
          visitId,
          "treatment_complete",
          tx.id,
        );
      }

      // 4. Complete the visit
      await onComplete();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-pk-surface rounded-pk-xl shadow-pk-e3 w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-pk-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-pk-text">Complete Visit</h2>
            <p className="text-xs text-pk-text-muted mt-0.5">
              Review treatment plans before closing this visit.
            </p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="text-pk-text-muted hover:text-pk-text-secondary text-xl leading-none ml-4"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {error && (
            <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-3 py-2">
              {error}
            </div>
          )}

          {decisions.map((d) => {
            const choice = choices[d.id];
            const teeth = d.toothNumbers?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

            return (
              <div key={d.id} className="border border-pk-border rounded-pk-lg p-4 space-y-3">
                {/* Treatment header */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-pk-text">{d.description}</p>
                    {d.procedure && (
                      <p className="text-xs text-pk-text-muted mt-0.5">{d.procedure}</p>
                    )}
                    {teeth.length > 0 && (
                      <div className="mt-1.5">
                        <ToothSelector value={teeth} readOnly compact />
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 space-y-0.5">
                    <p className="text-xs text-pk-text-muted">
                      Cost: <span className="font-medium text-pk-text-secondary">{formatCurrency(d.cost)}</span>
                    </p>
                    <p className="text-xs text-pk-text-muted">
                      Paid: <span className="font-medium text-pk-success-text">{formatCurrency(d.totalPaid)}</span>
                    </p>
                    {d.paidThisVisit > 0 && (
                      <p className="text-xs text-pk-teal-600">+{formatCurrency(d.paidThisVisit)} this visit</p>
                    )}
                  </div>
                </div>

                {/* Context notice */}
                {d.chartChangedThisVisit && (
                  <div className="flex items-center gap-1.5 text-xs text-pk-teal-700 bg-pk-teal-50 rounded px-2 py-1.5">
                    <span>🦷</span>
                    <span>Chart was updated for this treatment&apos;s teeth during this visit.</span>
                  </div>
                )}
                {d.totalPaid >= d.cost && d.cost > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-pk-success-text bg-pk-success-fill rounded px-2 py-1.5">
                    <span>✓</span>
                    <span>Full payment received ({formatCurrency(d.totalPaid)} of {formatCurrency(d.cost)}).</span>
                  </div>
                )}

                {/* Status decision */}
                <div>
                  <p className="text-xs font-medium text-pk-text-secondary mb-2">Update status:</p>
                  <div className="flex flex-wrap gap-2">
                    <label className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border cursor-pointer transition ${
                      choice === "keep"
                        ? "bg-pk-surface-raised border-pk-border-strong text-pk-text font-medium"
                        : "border-pk-border text-pk-text-muted hover:border-pk-border-strong"
                    }`}>
                      <input
                        type="radio"
                        name={`status-${d.id}`}
                        value="keep"
                        checked={choice === "keep"}
                        onChange={() => setChoices((c) => ({ ...c, [d.id]: "keep" }))}
                        className="hidden"
                      />
                      Keep as {d.status === "PLANNED" ? "Planned" : d.status === "IN_PROGRESS" ? "In Progress" : "Completed"}
                    </label>

                    {d.status !== "IN_PROGRESS" && d.status !== "COMPLETED" && (
                      <label className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border cursor-pointer transition ${
                        choice === "IN_PROGRESS"
                          ? "bg-pk-teal-50 border-pk-teal-300 text-pk-teal-800 font-medium"
                          : "border-pk-border text-pk-text-muted hover:border-pk-teal-300"
                      }`}>
                        <input
                          type="radio"
                          name={`status-${d.id}`}
                          value="IN_PROGRESS"
                          checked={choice === "IN_PROGRESS"}
                          onChange={() => setChoices((c) => ({ ...c, [d.id]: "IN_PROGRESS" }))}
                          className="hidden"
                        />
                        Mark In Progress
                        {d.suggestedStatus === "IN_PROGRESS" && (
                          <span className="text-pk-teal-500 text-xs">(suggested)</span>
                        )}
                      </label>
                    )}

                    <label className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border cursor-pointer transition ${
                      choice === "COMPLETED"
                        ? "bg-pk-success-fill border-pk-success-border text-pk-success-text font-medium"
                        : "border-pk-border text-pk-text-muted hover:border-pk-success-border"
                    }`}>
                      <input
                        type="radio"
                        name={`status-${d.id}`}
                        value="COMPLETED"
                        checked={choice === "COMPLETED"}
                        onChange={() => setChoices((c) => ({ ...c, [d.id]: "COMPLETED" }))}
                        className="hidden"
                      />
                      Mark Completed
                      {d.suggestedStatus === "COMPLETED" && (
                        <span className="text-pk-success-text text-xs">(suggested)</span>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Chart section — shown when any treatment needs a treatment_start entry (L4) */}
          {needsChartSection && (
            <div className="border border-pk-teal-200 rounded-pk-lg p-4 space-y-3 bg-pk-teal-50/40">
              <div>
                <p className="text-sm font-semibold text-pk-teal-800">Update Dental Chart</p>
                <p className="text-xs text-pk-teal-600 mt-0.5">
                  Mark the current condition of the teeth involved in the treatment(s) starting today.
                  This will be saved as the treatment-start snapshot.
                </p>
              </div>
              <ToothChart
                data={chartData}
                onChange={setChartData}
                highlightTeeth={decisions
                  .filter((d) => choices[d.id] === "IN_PROGRESS" && !d.hasChartStartEntry)
                  .flatMap((d) => d.toothNumbers?.split(",").map((s) => s.trim()).filter(Boolean) ?? [])
                }
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-pk-border flex-shrink-0">
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 bg-pk-teal-600 text-white px-4 py-2.5 rounded-pk-sm text-sm font-medium hover:bg-pk-teal-700 disabled:opacity-50 transition"
          >
            {submitting ? "Saving…" : "Confirm & Complete Visit"}
          </button>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2.5 border border-pk-border rounded-pk-sm text-sm font-medium text-pk-text-secondary hover:bg-pk-surface-raised transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
