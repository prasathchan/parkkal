"use client";

import type { Treatment } from "@/components/visits/types";
import { TREATMENT_STATUS } from "@/constants/treatment";

interface Props {
  treatments: Treatment[];
  onSelect: (treatment: Treatment) => void;
  onClose: () => void;
}

export function TreatmentPickerModal({ treatments, onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-pk-surface rounded-pk-lg shadow-pk-e3 border border-pk-border w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-pk-border">
          <h2 className="text-base font-semibold text-pk-text">Select Treatment Plan</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-pk-text-muted hover:text-pk-text-secondary text-lg leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {treatments.length === 0 ? (
            <p className="text-sm text-pk-text-muted py-4 text-center">
              No treatment plans linked to this visit. Go to the Treatment Plan tab to add one.
            </p>
          ) : (
            treatments.map((treatment) => {
              const outstanding = Math.max(0, treatment.cost - (treatment.billedAmount ?? 0));
              const toothPills = treatment.toothNumbers
                ? treatment.toothNumbers
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                : [];

              const statusBadge =
                treatment.status === TREATMENT_STATUS.PLANNED
                  ? "bg-pk-surface-sunken text-pk-text-muted"
                  : treatment.status === TREATMENT_STATUS.IN_PROGRESS
                  ? "bg-teal-100 text-pk-teal-700"
                  : "bg-pk-success-fill text-pk-success-text";

              const statusLabel =
                treatment.status === TREATMENT_STATUS.PLANNED
                  ? "Planned"
                  : treatment.status === TREATMENT_STATUS.IN_PROGRESS
                  ? "In Progress"
                  : "Completed";

              return (
                <button
                  key={treatment.id}
                  type="button"
                  onClick={() => { onSelect(treatment); onClose(); }}
                  className="w-full text-left rounded-pk-lg border border-pk-border hover:border-pk-teal-400 hover:bg-pk-teal-50 p-4 transition-all flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-sm text-pk-text">{treatment.description}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge}`}>
                        {statusLabel}
                      </span>
                    </div>
                    {treatment.procedure && (
                      <p className="text-xs text-pk-text-muted mb-1.5">{treatment.procedure}</p>
                    )}
                    {toothPills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {toothPills.map((t) => (
                          <span
                            key={t}
                            className="inline-block bg-teal-50 text-pk-teal-700 text-[10px] px-1.5 py-0.5 rounded font-mono"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-pk-text">
                      Est. ₹{treatment.cost.toLocaleString("en-IN")}
                    </p>
                    {outstanding > 0 && (
                      <p className="text-xs text-pk-warning-text mt-0.5">
                        Outstanding: ₹{outstanding.toLocaleString("en-IN")}
                      </p>
                    )}
                    {outstanding === 0 && (
                      <p className="text-xs text-pk-success-text mt-0.5">Fully billed</p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-pk-border">
          <button
            type="button"
            onClick={onClose}
            className="border border-pk-border text-pk-text-secondary px-4 py-2 rounded-pk-sm text-sm hover:bg-pk-surface-raised transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
