"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { patientsApi } from "@/api";
import { ToothChart, type ChartData } from "@/components/ui/ToothChart";
import type { ToothChartHistoryEntry, ToothConditionEntry } from "@/api/patients";

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

const CONDITION_COLORS: Record<string, { bg: string; text: string }> = {
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
  const col = CONDITION_COLORS[condition] ?? { bg: "#F5F3F0", text: "#847D6E" };
  return (
    <span
      className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded"
      style={{ background: col.bg, color: col.text }}
    >
      {label}
    </span>
  );
}

interface Props {
  patientId: string;
  chartData: ChartData;
  chartSaving: boolean;
  chartHistory: ToothChartHistoryEntry[];
  showHistory: boolean;
  onChartChange: (data: ChartData) => void;
  onToggleHistory: () => void;
}

export function PatientChartTab({ patientId, chartData, chartSaving, chartHistory, showHistory, onChartChange, onToggleHistory }: Props) {
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [toothHistory, setToothHistory] = useState<ToothConditionEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // Condition history grouped by tooth (for snapshot "what changed" enrichment)
  const [conditionHistory, setConditionHistory] = useState<ToothConditionEntry[]>([]);

  useEffect(() => {
    patientsApi.getToothConditionHistory(patientId, { limit: 200 })
      .then(({ history }) => setConditionHistory(history))
      .catch(() => {});
  }, [patientId]);

  async function handleToothSelect(tooth: string) {
    setSelectedTooth(tooth);
    setHistoryLoading(true);
    try {
      const { history } = await patientsApi.getToothConditionHistory(patientId, { toothNumber: tooth, limit: 20 });
      setToothHistory(history);
    } catch { setToothHistory([]); }
    setHistoryLoading(false);
  }

  // For each snapshot entry, get the condition changes that happened at that time
  function getChangesForSnapshot(entry: ToothChartHistoryEntry): Array<{ tooth: string; prev: string | null; next: string }> {
    const visitConditions = conditionHistory.filter(
      (h) => h.visitId === entry.visitId && entry.changedTeeth.includes(h.toothNumber),
    );
    if (visitConditions.length > 0) {
      return visitConditions.map((h) => ({ tooth: h.toothNumber, prev: h.previousCondition, next: h.newCondition }));
    }
    // Fallback: just list the teeth that changed without condition details
    return entry.changedTeeth.map((t) => ({ tooth: t, prev: null, next: (entry.toothData[t] as { condition?: string })?.condition ?? "UNKNOWN" }));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-pk-text">FDI Dental Chart</h3>
          <p className="text-xs text-pk-text-muted mt-0.5">Click any tooth to update its condition or view its history. Changes save automatically.</p>
        </div>
        {chartSaving && <span className="text-xs text-pk-text-muted animate-pulse">Saving…</span>}
      </div>

      <ToothChart data={chartData} onChange={onChartChange} onToothSelect={handleToothSelect} />

      {/* Per-tooth history panel — auto-shown on click */}
      <div className="mt-5 border-t border-pk-border pt-4">
        {!selectedTooth ? (
          <p className="text-xs text-pk-text-muted italic">Click any tooth above to view its condition history.</p>
        ) : (
          <div className="bg-pk-surface-raised border border-pk-border rounded-pk-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-pk-text">Tooth {selectedTooth} — Condition History</p>
              <button
                type="button"
                onClick={() => setSelectedTooth(null)}
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
                          {entry.visitCode && (
                            <> · <Link href={`/dashboard/visits/${entry.visitId}`} className="text-pk-teal-600 hover:underline font-mono">{entry.visitCode}</Link></>
                          )}
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

      {/* Snapshot history timeline */}
      {chartHistory.length > 0 && (
        <div className="mt-5 border-t border-pk-border pt-4">
          <button
            type="button"
            onClick={onToggleHistory}
            className="flex items-center gap-2 text-sm font-medium text-pk-text-secondary hover:text-pk-text transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${showHistory ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Chart History ({chartHistory.length} {chartHistory.length === 1 ? "save" : "saves"})
          </button>

          {showHistory && (
            <ol className="mt-3 space-y-4 border-l-2 border-pk-border pl-4">
              {chartHistory.map((snap) => {
                const changes = getChangesForSnapshot(snap);
                return (
                  <li key={snap.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-pk-neutral-300 border-2 border-white" />
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-xs font-medium text-pk-text-secondary">
                        {new Date(snap.recordedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span className="text-xs text-pk-text-muted">
                        {new Date(snap.recordedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {snap.visitCode && (
                        <Link href={`/dashboard/visits/${snap.visitId}`} className="text-xs text-pk-teal-600 hover:underline font-mono">
                          {snap.visitCode}
                        </Link>
                      )}
                      <span className="text-xs text-pk-text-muted">by {snap.recordedByName}</span>
                    </div>
                    {changes.length > 0 ? (
                      <ul className="mt-1.5 space-y-1">
                        {changes.map((c) => (
                          <li key={c.tooth} className="flex items-center gap-1.5 text-xs">
                            <span className="font-mono text-pk-text-secondary bg-pk-surface-sunken px-1 rounded text-[10px]">{c.tooth}</span>
                            {c.prev ? (
                              <>
                                <ConditionChip condition={c.prev} />
                                <span className="text-pk-text-muted">→</span>
                                <ConditionChip condition={c.next} />
                              </>
                            ) : (
                              <>
                                <span className="text-pk-text-muted text-[10px]">set to</span>
                                <ConditionChip condition={c.next} />
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-pk-text-muted mt-0.5">No condition changes</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
