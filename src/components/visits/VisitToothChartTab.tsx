"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { patientsApi } from "@/api";
import { ToothChart, type ChartData } from "@/components/ui/ToothChart";
import type { ToothConditionEntry } from "@/api/patients";
import type { VisitItem } from "./types";

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

interface Props {
  visitId: string;
  patientId: string;
  visitStatus: "OPEN" | "COMPLETED" | "CANCELLED";
  items: VisitItem[];
}

const SAVE_DEBOUNCE_MS = 700;

export function VisitToothChartTab({ visitId, patientId, visitStatus, items }: Props) {
  const [chartData, setChartData]         = useState<ChartData>({});
  const [snapshotAt, setSnapshotAt]       = useState<number | null>(null); // when the visit snapshot was recorded
  const [hasVisitSnapshot, setHasVisitSnapshot] = useState<boolean | null>(null); // null = loading
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [savedAt, setSavedAt]             = useState<number | null>(null);
  const [error, setError]                 = useState("");

  // Per-tooth history popover
  const [historyTooth, setHistoryTooth]   = useState<string | null>(null);
  const [toothHistory, setToothHistory]   = useState<ToothConditionEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Used only for OPEN visits
  const saveInFlight  = useRef(false);
  const latestData    = useRef<ChartData>({});
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOpen   = visitStatus === "OPEN";
  const readOnly = !isOpen;

  // Teeth referenced in this visit's bill — highlighted as a hint
  const billedTeeth = Array.from(
    new Set(
      items
        .map((i) => i.toothNumber?.trim())
        .filter((t): t is string => !!t && /^[1-4][1-8]$/.test(t))
    )
  ).sort((a, b) => Number(a) - Number(b));

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (isOpen) {
          // Pre-fill from the living cumulative chart
          const { toothData } = await patientsApi.getToothChart(patientId);
          if (!cancelled) {
            setChartData((toothData as ChartData) ?? {});
            setHasVisitSnapshot(false);
          }
        } else {
          // Show the frozen snapshot recorded during this visit (if any)
          const { history } = await patientsApi.getToothChartHistory(patientId, visitId);
          if (!cancelled) {
            if (history.length > 0) {
              // history is newest-first; [0] is the last save made during this visit
              setChartData(history[0].toothData as ChartData);
              setSnapshotAt(history[0].recordedAt);
              setHasVisitSnapshot(true);
            } else {
              // No chart edits were made during this visit — fall back to current cumulative
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

  // ── Save (OPEN visits only) ──────────────────────────────────────────────────

  const flushSave = useCallback(async () => {
    if (saveInFlight.current) return;

    saveInFlight.current = true;
    setSaving(true);
    setError("");

    try {
      // Loop until no new changes arrived during the in-flight request
      while (true) {
        const toSave = latestData.current;
        await patientsApi.saveToothChart(patientId, toSave as Record<string, unknown>, visitId, "manual");
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

  async function handleToothHistoryClick(tooth: string) {
    if (historyTooth === tooth) { setHistoryTooth(null); return; }
    setHistoryTooth(tooth);
    setHistoryLoading(true);
    try {
      const { history } = await patientsApi.getToothConditionHistory(patientId, { toothNumber: tooth, limit: 10 });
      setToothHistory(history);
    } catch { setToothHistory([]); }
    setHistoryLoading(false);
  }

  const handleChange = useCallback((data: ChartData) => {
    setChartData(data);
    latestData.current = data;

    // Debounce: reset the timer on every change so rapid edits coalesce
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
      />

      {/* Per-tooth history — click any tooth number label to open */}
      <div className="mt-4 border-t border-pk-border pt-4">
        <p className="text-xs text-pk-text-muted mb-2">
          View tooth history:{" "}
          <span className="text-pk-text-secondary">click a tooth number below</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(chartData).sort().map((tooth) => (
            <button
              key={tooth}
              type="button"
              onClick={() => handleToothHistoryClick(tooth)}
              className={`text-xs px-2 py-1 rounded border transition ${
                historyTooth === tooth
                  ? "bg-pk-teal-600 text-white border-pk-teal-600"
                  : "border-pk-border text-pk-text-muted hover:border-pk-teal-400 hover:text-pk-teal-700"
              }`}
            >
              {tooth}
            </button>
          ))}
        </div>

        {historyTooth && (
          <div className="mt-3 bg-pk-surface-raised border border-pk-border rounded-pk-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-pk-text">Tooth {historyTooth} — History</p>
              <button
                type="button"
                onClick={() => setHistoryTooth(null)}
                className="text-pk-text-muted hover:text-pk-text-secondary text-sm leading-none"
              >
                &times;
              </button>
            </div>
            {historyLoading ? (
              <p className="text-xs text-pk-text-muted">Loading…</p>
            ) : toothHistory.length === 0 ? (
              <p className="text-xs text-pk-text-muted">No history recorded for this tooth.</p>
            ) : (
              <ol className="space-y-2">
                {toothHistory.map((entry, i) => (
                  <li key={entry.id} className="flex items-start gap-2 text-xs">
                    <span className="text-pk-text-muted flex-shrink-0 mt-0.5">{i + 1}.</span>
                    <div>
                      <span className="text-pk-text font-medium">
                        {entry.previousCondition
                          ? `${CONDITION_LABELS[entry.previousCondition] ?? entry.previousCondition} → ${CONDITION_LABELS[entry.newCondition] ?? entry.newCondition}`
                          : `First recorded: ${CONDITION_LABELS[entry.newCondition] ?? entry.newCondition}`}
                      </span>
                      <span className="text-pk-text-muted ml-1.5">
                        {new Date(entry.recordedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {entry.visitCode && ` · ${entry.visitCode}`}
                        {entry.source === "treatment_start" && " · Treatment start"}
                        {entry.source === "treatment_complete" && " · Treatment complete"}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
