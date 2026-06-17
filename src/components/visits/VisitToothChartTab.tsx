"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { patientsApi } from "@/api";
import { ToothChart, type ChartData, type ToothCondition } from "@/components/ui/ToothChart";
import type { ToothConditionEntry } from "@/api/patients";
import type { VisitItem, Treatment } from "./types";

const CONDITION_LABELS: Record<string, string> = {
  HEALTHY:    "Healthy",
  CARIES:     "Cavity",
  FILLING:    "Filling",
  CROWN:      "Crown",
  MISSING:    "Missing",
  ROOT_CANAL: "Root Canal",
  BRIDGE:     "Bridge",
  IMPLANT:    "Implant",
  FRACTURED:  "Fractured",
  WATCH:      "Watch",
};

const CONDITION_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  HEALTHY:    { bg: "#F5F3F0", text: "#847D6E" },
  CARIES:     { bg: "#C0392B", text: "#FFFFFF" },
  FILLING:    { bg: "#0B6E6E", text: "#FFFFFF" },
  CROWN:      { bg: "#C8873A", text: "#FFFFFF" },
  MISSING:    { bg: "#C4BDB0", text: "#4A4439" },
  ROOT_CANAL: { bg: "#6B4A2F", text: "#FFFFFF" },
  BRIDGE:     { bg: "#0B5654", text: "#FFFFFF" },
  IMPLANT:    { bg: "#6E7B7E", text: "#FFFFFF" },
  FRACTURED:  { bg: "#B35B43", text: "#FFFFFF" },
  WATCH:      { bg: "#FCEFD6", text: "#9A5B0A" },
};

const SOURCE_LABELS: Record<string, string> = {
  manual:             "✏ Manual",
  treatment_start:    "▶ Treatment started",
  treatment_complete: "✓ Treatment completed",
};

function ConditionChip({ condition }: { condition: string }) {
  const label = CONDITION_LABELS[condition] ?? condition;
  const colors = CONDITION_CHIP_COLORS[condition] ?? { bg: "#F5F3F0", text: "#847D6E" };
  return (
    <span
      className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded"
      style={{ background: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  );
}

interface Props {
  visitId: string;
  patientId: string;
  visitStatus: "OPEN" | "COMPLETED" | "CANCELLED";
  items: VisitItem[];
  treatments: Treatment[];
  onSuggestBill?: (treatmentId: string, treatmentDescription: string, toothNumber: string) => void;
  externalHighlightTeeth?: string[];
}

const SAVE_DEBOUNCE_MS = 700;

export function VisitToothChartTab({
  visitId,
  patientId,
  visitStatus,
  items,
  treatments,
  onSuggestBill,
  externalHighlightTeeth,
}: Props) {
  const [chartData, setChartData]         = useState<ChartData>({});
  const [snapshotAt, setSnapshotAt]       = useState<number | null>(null);
  const [hasVisitSnapshot, setHasVisitSnapshot] = useState<boolean | null>(null);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [savedAt, setSavedAt]             = useState<number | null>(null);
  const [error, setError]                 = useState("");

  // Per-tooth history popover
  const [historyTooth, setHistoryTooth]   = useState<string | null>(null);
  const [toothHistory, setToothHistory]   = useState<ToothConditionEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Gap 6b — all teeth that have any history entry
  const [teethWithHistory, setTeethWithHistory] = useState<string[]>([]);

  // Used only for OPEN visits
  const saveInFlight       = useRef(false);
  const latestData         = useRef<ChartData>({});
  const debounceTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTreatmentId  = useRef<string | null>(null);

  const isOpen   = visitStatus === "OPEN";
  const readOnly = !isOpen;

  // Teeth referenced in this visit's bill — highlighted as a hint
  const billedTeeth = Array.from(
    new Set(
      items
        .map((i) => i.toothNumber?.trim())
        .filter((t): t is string => !!t && /^[1-4][1-8]$/.test(t)),
    ),
  ).sort((a, b) => Number(a) - Number(b));

  // Combined highlight set: billed + external (from bill→chart suggestion)
  const allHighlightTeeth = Array.from(
    new Set([...billedTeeth, ...(externalHighlightTeeth ?? [])]),
  );

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (isOpen) {
          const { toothData } = await patientsApi.getToothChart(patientId);
          if (!cancelled) {
            setChartData((toothData as ChartData) ?? {});
            setHasVisitSnapshot(false);
          }
        } else {
          const { history } = await patientsApi.getToothChartHistory(patientId, visitId);
          if (!cancelled) {
            if (history.length > 0) {
              setChartData(history[0].toothData as ChartData);
              setSnapshotAt(history[0].recordedAt);
              setHasVisitSnapshot(true);
            } else {
              const { toothData } = await patientsApi.getToothChart(patientId);
              if (!cancelled) {
                setChartData((toothData as ChartData) ?? {});
                setHasVisitSnapshot(false);
              }
            }
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load tooth chart");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [patientId, visitId, isOpen]);

  // Gap 6b — fetch teeth with any history; re-fetch after each successful save
  useEffect(() => {
    if (loading) return;
    patientsApi
      .getToothConditionHistory(patientId, { limit: 200 })
      .then(({ history }) => {
        const seen = new Set(history.map((h) => h.toothNumber));
        setTeethWithHistory(
          Array.from(seen).sort((a, b) => Number(a) - Number(b)),
        );
      })
      .catch(() => {});
  // savedAt intentionally included: re-fetch after every successful save
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, loading, savedAt]);

  // ── Save (OPEN visits only) ──────────────────────────────────────────────────

  const flushSave = useCallback(async () => {
    if (saveInFlight.current) return;

    saveInFlight.current = true;
    setSaving(true);
    setError("");

    try {
      while (true) {
        const toSave = latestData.current;
        await patientsApi.saveToothChart(
          patientId,
          toSave as Record<string, unknown>,
          visitId,
          "manual",
          latestTreatmentId.current ?? undefined,
        );
        if (latestData.current === toSave) break;
      }
      setSavedAt(Date.now());
      setHasVisitSnapshot(true);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }, [patientId, visitId]);

  // Gap 4 — tooth change handler that fires bill suggestion
  function handleToothChange(toothNumber: string, newCondition: ToothCondition, treatmentId: string | null) {
    latestTreatmentId.current = treatmentId;
    if (treatmentId && newCondition !== "HEALTHY" && isOpen) {
      const tx = treatments.find((t) => t.id === treatmentId);
      if (tx) {
        onSuggestBill?.(treatmentId, tx.description, toothNumber);
      }
    }
  }

  async function handleToothSelect(tooth: string) {
    if (historyTooth === tooth) return; // already shown — keep open; popover handles close
    setHistoryTooth(tooth);
    setHistoryLoading(true);
    try {
      const { history } = await patientsApi.getToothConditionHistory(patientId, { toothNumber: tooth, limit: 20 });
      setToothHistory(history);
    } catch { setToothHistory([]); }
    setHistoryLoading(false);
  }

  const handleChange = useCallback((data: ChartData) => {
    setChartData(data);
    latestData.current = data;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return <p className="text-sm text-pk-text-muted py-6 text-center">Loading chart…</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-pk-text">FDI Dental Chart</h3>
          <p className="text-xs text-pk-text-muted mt-0.5">
            {isOpen
              ? "Click any tooth to update its condition. Changes are saved to the patient's cumulative chart and recorded as a snapshot for this visit."
              : hasVisitSnapshot
                ? `Snapshot recorded during this visit on ${snapshotAt ? new Date(snapshotAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}.`
                : "No chart edits were recorded during this visit. Showing current cumulative chart for reference."}
          </p>
        </div>
        <div className="text-right flex-shrink-0 min-w-[80px]">
          {isOpen && saving && <p className="text-xs text-pk-text-muted animate-pulse">Saving…</p>}
          {isOpen && !saving && savedAt && (
            <p className="text-xs text-pk-success-text">
              Saved {new Date(savedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          {!isOpen && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              hasVisitSnapshot
                ? "bg-pk-teal-50 text-pk-teal-700"
                : "bg-pk-surface-sunken text-pk-text-muted"
            }`}>
              {hasVisitSnapshot ? "Visit snapshot" : "Cumulative ref"}
            </span>
          )}
        </div>
      </div>

      {/* Billed teeth hint */}
      {billedTeeth.length > 0 && isOpen && (
        <div className="mb-4 flex items-center gap-2 rounded-pk-sm bg-pk-warning-fill border border-pk-warning-border px-3 py-2">
          <svg className="w-4 h-4 text-pk-warning-text flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-pk-warning-text">
            This visit&apos;s bill references{" "}
            <span className="font-semibold">
              {billedTeeth.length === 1 ? `tooth ${billedTeeth[0]}` : `teeth ${billedTeeth.join(", ")}`}
            </span>
            {" "}— update their conditions below after treatment.
          </p>
        </div>
      )}

      {/* No-snapshot notice for completed visits */}
      {!isOpen && !hasVisitSnapshot && (
        <div className="mb-4 flex items-center gap-2 rounded-pk-sm bg-pk-surface-raised border border-pk-border px-3 py-2">
          <svg className="w-4 h-4 text-pk-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-pk-text-muted">
            The chart was not updated during this visit. Showing the current cumulative chart for reference only.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-pk-danger-text mb-3">{error}</p>}

      <ToothChart
        data={chartData}
        readOnly={readOnly}
        onChange={isOpen ? handleChange : undefined}
        highlightTeeth={allHighlightTeeth}
        linkedTreatments={treatments}
        onToothChange={isOpen ? handleToothChange : undefined}
        onToothSelect={handleToothSelect}
      />

      {/* Per-tooth history — auto-shown when a tooth is clicked */}
      <div className="mt-4 border-t border-pk-border pt-4">
        {!historyTooth && (
          <p className="text-xs text-pk-text-muted italic">
            Click any tooth above to view its condition history.
          </p>
        )}

        {historyTooth && (
          <div className="bg-pk-surface-raised border border-pk-border rounded-pk-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-pk-text">Tooth {historyTooth} — Condition History</p>
                {teethWithHistory.length > 1 && (
                  <p className="text-xs text-pk-text-muted mt-0.5">
                    {teethWithHistory.length} teeth with recorded history
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setHistoryTooth(null)}
                className="text-pk-text-muted hover:text-pk-text-secondary text-lg leading-none"
              >
                &times;
              </button>
            </div>
            {historyLoading ? (
              <p className="text-xs text-pk-text-muted">Loading…</p>
            ) : toothHistory.length === 0 ? (
              <p className="text-xs text-pk-text-muted italic">No condition changes recorded for this tooth yet.</p>
            ) : (
              <ol className="space-y-3">
                {toothHistory.map((entry, i) => {
                  const procedureLabel = entry.treatmentProcedure || entry.treatmentDescription;
                  return (
                    <li key={entry.id} className="flex items-start gap-3 text-xs">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-pk-teal-100 text-pk-teal-700 font-bold flex items-center justify-center text-[10px]">
                        {toothHistory.length - i}
                      </span>
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {entry.previousCondition ? (
                            <>
                              <ConditionChip condition={entry.previousCondition} />
                              <span className="text-pk-text-muted">→</span>
                              <ConditionChip condition={entry.newCondition} />
                            </>
                          ) : (
                            <>
                              <span className="text-pk-text-muted">First recorded as</span>
                              <ConditionChip condition={entry.newCondition} />
                            </>
                          )}
                        </div>
                        {procedureLabel && (
                          <p className="text-pk-teal-700 font-medium truncate">{procedureLabel}</p>
                        )}
                        <p className="text-pk-text-muted">
                          {new Date(entry.recordedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          {entry.visitCode && <> · <span className="font-mono">{entry.visitCode}</span></>}
                          {" · "}{SOURCE_LABELS[entry.source] ?? entry.source}
                          {entry.recordedByName && ` · ${entry.recordedByName}`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
