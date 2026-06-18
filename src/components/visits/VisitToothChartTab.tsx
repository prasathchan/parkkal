"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { patientsApi } from "@/api";
import { ToothChart, type ChartData, type ToothCondition } from "@/components/ui/ToothChart";
import type { ToothConditionEntry, ToothChartHistoryEntry } from "@/api/patients";
import type { VisitItem, Treatment } from "./types";

// Derive per-tooth history from old snapshots (fallback for teeth marked before migration 0048)
function deriveHistoryFromSnapshots(tooth: string, snapshots: ToothChartHistoryEntry[]): ToothConditionEntry[] {
  const sorted = [...snapshots].sort((a, b) => a.recordedAt - b.recordedAt);
  const entries: ToothConditionEntry[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const snap = sorted[i];
    if (!(snap.changedTeeth as string[]).includes(tooth)) continue;
    const newCondition = (snap.toothData[tooth] as { condition?: string } | undefined)?.condition ?? "HEALTHY";
    let previousCondition: string | null = null;
    for (let j = i - 1; j >= 0; j--) {
      const prev = (sorted[j].toothData[tooth] as { condition?: string } | undefined)?.condition;
      if (prev) { previousCondition = prev; break; }
    }
    entries.push({
      id: `snap-${snap.id}-${tooth}`,
      toothNumber: tooth,
      previousCondition,
      newCondition,
      visitId: snap.visitId,
      visitCode: snap.visitCode,
      visitDate: null,
      treatmentId: null,
      treatmentDescription: null,
      treatmentProcedure: null,
      source: "manual",
      recordedBy: snap.recordedBy,
      recordedByName: snap.recordedByName,
      recordedAt: snap.recordedAt,
    });
  }
  return entries.reverse();
}

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
  const label  = CONDITION_LABELS[condition]  ?? condition;
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

// Quadrant definitions
const QUADRANTS = [
  { label: "UR", teeth: ["11","12","13","14","15","16","17","18"] },
  { label: "UL", teeth: ["21","22","23","24","25","26","27","28"] },
  { label: "LL", teeth: ["31","32","33","34","35","36","37","38"] },
  { label: "LR", teeth: ["41","42","43","44","45","46","47","48"] },
  { label: "All Upper", teeth: ["11","12","13","14","15","16","17","18","21","22","23","24","25","26","27","28"] },
  { label: "All Lower", teeth: ["31","32","33","34","35","36","37","38","41","42","43","44","45","46","47","48"] },
];

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
  const [chartData, setChartData]               = useState<ChartData>({});
  const [snapshotAt, setSnapshotAt]             = useState<number | null>(null);
  const [hasVisitSnapshot, setHasVisitSnapshot] = useState<boolean | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [saving, setSaving]                     = useState(false);
  const [savedAt, setSavedAt]                   = useState<number | null>(null);
  const [error, setError]                       = useState("");

  // Undo stack — each entry is a full ChartData snapshot before a quadrant action
  const [undoStack, setUndoStack] = useState<ChartData[]>([]);

  // Per-tooth history panel
  const [historyTooth, setHistoryTooth]         = useState<string | null>(null);
  const [toothHistory, setToothHistory]         = useState<ToothConditionEntry[]>([]);
  const [historyLoading, setHistoryLoading]     = useState(false);
  // Counter — incremented after a successful save to refresh the history panel
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  // Cached full chart snapshots — fetched lazily as fallback
  const [chartHistoryCache, setChartHistoryCache] = useState<ToothChartHistoryEntry[] | null>(null);

  const saveInFlight       = useRef(false);
  const latestData         = useRef<ChartData>({});
  const debounceTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTreatmentId  = useRef<string | null>(null);
  const historyToothRef    = useRef<string | null>(null);
  historyToothRef.current  = historyTooth;

  const isOpen   = visitStatus === "OPEN";
  const readOnly = !isOpen;

  // Teeth referenced in this visit's bill items or linked treatment plans
  const billedTeeth = Array.from(
    new Set([
      ...items
        .map((i) => i.toothNumber?.trim())
        .filter((t): t is string => !!t && /^[1-4][1-8]$/.test(t)),
      ...treatments.flatMap((tx) =>
        tx.toothNumbers
          ? tx.toothNumbers.split(",").map(s => s.trim()).filter(t => /^[1-4][1-8]$/.test(t))
          : []
      ),
    ]),
  ).sort((a, b) => Number(a) - Number(b));

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
            latestData.current = (toothData as ChartData) ?? {};
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
                latestData.current = (toothData as ChartData) ?? {};
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

  // Pre-warm chart history cache (fallback for pre-migration teeth)
  useEffect(() => {
    if (loading || chartHistoryCache !== null) return;
    patientsApi.getToothChartHistory(patientId)
      .then(({ history }) => setChartHistoryCache(history))
      .catch(() => setChartHistoryCache([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, loading]);

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
      // Refresh the history panel after a successful save so new entries appear
      setHistoryRefreshKey(k => k + 1);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }, [patientId, visitId]);

  // ── Per-tooth history fetch ──────────────────────────────────────────────────

  const fetchToothHistory = useCallback(async (tooth: string) => {
    setHistoryLoading(true);
    try {
      const { history } = await patientsApi.getToothConditionHistory(patientId, { toothNumber: tooth, limit: 20 });
      if (history.length > 0) {
        setToothHistory(history);
      } else {
        const snapshots = chartHistoryCache ?? (
          await patientsApi.getToothChartHistory(patientId).then(r => r.history).catch(() => [])
        );
        if (chartHistoryCache === null) setChartHistoryCache(snapshots);
        setToothHistory(deriveHistoryFromSnapshots(tooth, snapshots));
      }
    } catch {
      setToothHistory([]);
    }
    setHistoryLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, chartHistoryCache]);

  // Re-fetch history panel whenever historyRefreshKey changes (post-save)
  useEffect(() => {
    if (!historyToothRef.current || historyRefreshKey === 0) return;
    fetchToothHistory(historyToothRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyRefreshKey]);

  function handleToothSelect(tooth: string) {
    setHistoryTooth(tooth);
    fetchToothHistory(tooth);
  }

  // ── Condition change handler ─────────────────────────────────────────────────

  function handleToothChange(toothNumber: string, newCondition: ToothCondition, treatmentId: string | null) {
    latestTreatmentId.current = treatmentId;
    if (treatmentId && newCondition !== "HEALTHY" && isOpen) {
      const tx = treatments.find((t) => t.id === treatmentId);
      if (tx) onSuggestBill?.(treatmentId, tx.description, toothNumber);
    }
  }

  const handleChange = useCallback((data: ChartData) => {
    setChartData(data);
    latestData.current = data;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  // ── Quadrant actions ─────────────────────────────────────────────────────────

  /**
   * Mark all HEALTHY teeth in a set as the given condition.
   * Non-HEALTHY teeth are NEVER overwritten — this is a safe, additive action.
   * The pre-action state is pushed to the undo stack.
   */
  function handleQuadrantMark(teeth: string[], condition: ToothCondition = "CARIES") {
    const before = { ...latestData.current };
    const healthyTeeth = teeth.filter(t => !latestData.current[t] || latestData.current[t]?.condition === "HEALTHY");
    if (healthyTeeth.length === 0) return; // nothing to mark

    // Push current state to undo stack (keep last 10)
    setUndoStack(prev => [...prev.slice(-9), before]);

    const next = { ...latestData.current };
    healthyTeeth.forEach(t => { next[t] = { condition }; });
    handleChange(next);
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    handleChange({ ...prev });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

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
              ? "Click a tooth to view its history and update its condition."
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

      {/* Read-only notice */}
      {!isOpen && (
        <div className="mb-4 flex items-center gap-2 rounded-pk-sm bg-pk-surface-raised border border-pk-border px-3 py-2.5">
          <svg className="w-4 h-4 text-pk-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-xs text-pk-text-muted">
            <span className="font-medium text-pk-text-secondary">Chart is view-only for this visit.</span>
            {" "}Click any tooth to view its condition history.
          </p>
        </div>
      )}

      {!isOpen && !hasVisitSnapshot && (
        <div className="mb-4 flex items-center gap-2 rounded-pk-sm bg-pk-surface-raised border border-pk-border px-3 py-2">
          <svg className="w-4 h-4 text-pk-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-pk-text-muted">
            The chart was not updated during this visit. Showing the current cumulative chart for reference.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-pk-danger-text mb-3">{error}</p>}

      {/* Quadrant quick-select — OPEN visits only */}
      {isOpen && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-pk-text-muted font-medium">Quick mark:</span>
            {QUADRANTS.map(({ label, teeth }) => {
              const healthyCount   = teeth.filter(t => !chartData[t] || chartData[t]?.condition === "HEALTHY").length;
              const allMarked      = healthyCount === 0;
              const partiallyMarked = !allMarked && healthyCount < teeth.length;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={allMarked}
                  title={
                    allMarked
                      ? `All ${label} teeth already have conditions set`
                      : `Mark ${healthyCount} healthy ${label} ${healthyCount === 1 ? "tooth" : "teeth"} as Caries`
                  }
                  onClick={() => handleQuadrantMark(teeth)}
                  className={`text-xs px-2.5 py-1 rounded-pk-sm border font-medium transition ${
                    allMarked
                      ? "bg-pk-teal-600 text-white border-pk-teal-600 opacity-60 cursor-not-allowed"
                      : partiallyMarked
                      ? "bg-pk-surface border-pk-warning-border text-pk-warning-text hover:bg-pk-warning-fill"
                      : "bg-pk-surface border-pk-border text-pk-text-secondary hover:bg-pk-surface-raised"
                  }`}
                >
                  {label}
                  {partiallyMarked && (
                    <span className="ml-1 opacity-70">({teeth.length - healthyCount}/{teeth.length})</span>
                  )}
                </button>
              );
            })}

            {/* Undo button — only shown when there are quadrant actions to undo */}
            {undoStack.length > 0 && (
              <button
                type="button"
                onClick={handleUndo}
                className="text-xs px-2.5 py-1 rounded-pk-sm border border-pk-border font-medium text-pk-text-secondary bg-pk-surface hover:bg-pk-surface-raised transition flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Undo
                {undoStack.length > 1 && (
                  <span className="ml-0.5 opacity-60">({undoStack.length})</span>
                )}
              </button>
            )}
          </div>
          <p className="text-[10px] text-pk-text-muted mt-1.5">
            Marks only healthy teeth as Caries. Existing conditions (fillings, crowns, etc.) are never overwritten.
            Use Undo to revert the last mark action.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <ToothChart
          data={chartData}
          readOnly={readOnly}
          onChange={isOpen ? handleChange : undefined}
          highlightTeeth={allHighlightTeeth}
          linkedTreatments={treatments}
          onToothChange={isOpen ? handleToothChange : undefined}
          onToothSelect={handleToothSelect}
        />
      </div>

      {/* Per-tooth history panel — auto-shown when a tooth is clicked */}
      <div className="mt-4 border-t border-pk-border pt-4">
        {!historyTooth && (
          <p className="text-xs text-pk-text-muted italic">
            Click any tooth above to view its condition history.
          </p>
        )}

        {historyTooth && (
          <div className="bg-pk-surface-raised border border-pk-border rounded-pk-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-pk-text">Tooth {historyTooth} — History</p>
                {/* Current condition chip */}
                {(() => {
                  const current = chartData[historyTooth]?.condition;
                  if (!current || current === "HEALTHY") return null;
                  const colors = CONDITION_CHIP_COLORS[current] ?? { bg: "#F5F3F0", text: "#847D6E" };
                  return (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ background: colors.bg, color: colors.text }}
                    >
                      {CONDITION_LABELS[current] ?? current}
                    </span>
                  );
                })()}
              </div>
              <button
                type="button"
                onClick={() => setHistoryTooth(null)}
                className="text-pk-text-muted hover:text-pk-text-secondary text-lg leading-none"
                aria-label="Close history panel"
              >
                &times;
              </button>
            </div>

            {historyLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-pk-surface animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-32 bg-pk-surface animate-pulse rounded" />
                      <div className="h-3 w-48 bg-pk-surface animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : toothHistory.length === 0 ? (
              <p className="text-xs text-pk-text-muted italic">
                No condition changes recorded for tooth {historyTooth} yet.
                {isOpen && " Change its condition above to start tracking."}
              </p>
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
