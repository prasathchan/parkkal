"use client";

import { useState, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToothCondition =
  | "HEALTHY" | "CARIES" | "FILLING" | "CROWN" | "MISSING"
  | "ROOT_CANAL" | "BRIDGE" | "IMPLANT" | "FRACTURED" | "WATCH";

export interface ToothData {
  condition: ToothCondition;
  notes?: string;
}

export type ChartData = Partial<Record<string, ToothData>>;

// ─── Constants ────────────────────────────────────────────────────────────────

// Brand odontogram palette (Brand System §3.1) — warm family only, no blue/purple.
// Solid fills carry white glyph text; light statuses carry dark text.
const CONDITION_COLORS: Record<ToothCondition, { bg: string; border: string; text: string }> = {
  HEALTHY:    { bg: "#FFFFFF", border: "#B0A99B", text: "#847D6E" }, // neutral outline
  CARIES:     { bg: "#C0392B", border: "#C0392B", text: "#FFFFFF" }, // danger red
  FILLING:    { bg: "#0B6E6E", border: "#0B6E6E", text: "#FFFFFF" }, // teal
  CROWN:      { bg: "#C8873A", border: "#C8873A", text: "#FFFFFF" }, // gold ◆
  MISSING:    { bg: "#C4BDB0", border: "#B0A99B", text: "#4A4439" }, // light warm grey ✕
  ROOT_CANAL: { bg: "#6B4A2F", border: "#6B4A2F", text: "#FFFFFF" }, // umber ▽
  BRIDGE:     { bg: "#0B5654", border: "#0B5654", text: "#FFFFFF" }, // deep teal
  IMPLANT:    { bg: "#6E7B7E", border: "#6E7B7E", text: "#FFFFFF" }, // steel grey
  FRACTURED:  { bg: "#B35B43", border: "#B35B43", text: "#FFFFFF" }, // terracotta
  WATCH:      { bg: "#FCEFD6", border: "#B8770F", text: "#9A5B0A" }, // warning attention
};

const CONDITION_LABELS: Record<ToothCondition, string> = {
  HEALTHY:    "Healthy",
  CARIES:     "Caries (Decay)",
  FILLING:    "Filling",
  CROWN:      "Crown",
  MISSING:    "Missing",
  ROOT_CANAL: "Root Canal",
  BRIDGE:     "Bridge",
  IMPLANT:    "Implant",
  FRACTURED:  "Fractured",
  WATCH:      "Watch",
};

const ALL_CONDITIONS = Object.keys(CONDITION_LABELS) as ToothCondition[];

// FDI layout — upper and lower rows from patient left to right
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToothType(n: number): "molar" | "premolar" | "canine" | "incisor" {
  const d = n % 10;
  if (d >= 6) return "molar";
  if (d === 4 || d === 5) return "premolar";
  if (d === 3) return "canine";
  return "incisor";
}

// ─── Single tooth cell ────────────────────────────────────────────────────────

function ToothCell({
  number,
  data,
  isUpper,
  readOnly,
  highlight,
  linkedTreatment,
  onConditionChange,
  onToothSelect,
}: {
  number: number;
  data: ToothData | undefined;
  isUpper: boolean;
  readOnly: boolean;
  highlight?: boolean;
  linkedTreatment?: { id: string; description: string; procedure?: string | null };
  onConditionChange: (n: number, condition: ToothCondition, notes?: string) => void;
  onToothSelect?: (toothNumber: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editNotes, setEditNotes] = useState(data?.notes ?? "");
  const [pendingCondition, setPendingCondition] = useState<ToothCondition | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const condition: ToothCondition = data?.condition ?? "HEALTHY";
  const displayCondition: ToothCondition = pendingCondition ?? condition;
  const colors = CONDITION_COLORS[displayCondition];
  const type = getToothType(number);
  const originalNotes = data?.notes ?? "";
  const hasChange = (pendingCondition !== null && pendingCondition !== condition) || editNotes !== originalNotes;

  // Close on outside click — also discards any pending change
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPendingCondition(null);
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleOpen() {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const popoverWidth = 216;
    const popoverHeight = 340;
    const spaceBelow = window.innerHeight - rect.bottom;

    let top: number | undefined;
    let bottom: number | undefined;
    if (spaceBelow >= popoverHeight || spaceBelow >= rect.top) {
      top = rect.bottom + 4;
    } else {
      bottom = window.innerHeight - rect.top + 4;
    }

    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8));

    setPendingCondition(null);
    setPopoverPos({ top, bottom, left });
    setEditNotes(data?.notes ?? "");
    setOpen(true);
  }

  const height = type === "molar" ? "h-16" : type === "premolar" ? "h-14" : "h-12";

  return (
    <div ref={ref} className="relative flex flex-col items-center">
      {/* Tooth number label — above for upper, below for lower */}
      {isUpper && (
        <span className="text-[9px] text-pk-text-muted mb-0.5 leading-none select-none">{number}</span>
      )}

      {/* Tooth shape */}
      <button
        type="button"
        disabled={readOnly}
        title={CONDITION_LABELS[condition] + (data?.notes ? ` — ${data.notes}` : "")}
        onClick={() => {
          onToothSelect?.(String(number));
          if (!readOnly) handleOpen();
        }}
        className={`w-9 ${height} rounded-sm border-2 transition-all focus:outline-none relative ${readOnly ? "cursor-pointer" : "hover:scale-110 hover:z-10 cursor-pointer"} ${highlight ? "ring-2 ring-pk-teal-400 ring-offset-1" : ""}`}
        style={{ background: colors.bg, borderColor: colors.border }}
      >
        {/* Glyph overlays — colour-blind-safe cues (Brand §3.1). displayCondition gives live preview of pending change. */}
        {displayCondition === "MISSING" && (
          <span className="absolute inset-0 flex items-center justify-center text-pk-neutral-700 text-xs font-bold">✕</span>
        )}
        {displayCondition === "CROWN" && (
          <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold">◆</span>
        )}
        {displayCondition === "ROOT_CANAL" && (
          <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold">▽</span>
        )}
        {displayCondition === "BRIDGE" && (
          <span className="absolute inset-0 flex items-center justify-center text-white text-[8px] font-bold">BR</span>
        )}
        {displayCondition === "IMPLANT" && (
          <span className="absolute inset-0 flex items-center justify-center text-white text-[8px] font-bold">IM</span>
        )}
      </button>

      {!isUpper && (
        <span className="text-[9px] text-pk-text-muted mt-0.5 leading-none select-none">{number}</span>
      )}

      {/* Condition popover — position:fixed escapes overflow-x:auto clipping on the chart scroll container */}
      {open && popoverPos && (
        <div
          style={{
            position: "fixed",
            top: popoverPos.top,
            bottom: popoverPos.bottom,
            left: popoverPos.left,
            width: "216px",
            zIndex: 9999,
          }}
          className="bg-pk-surface rounded-pk-lg shadow-pk-e3 border border-pk-border p-2"
        >
          <p className="text-xs font-semibold text-pk-text-secondary px-1 pb-1 border-b border-pk-border mb-1">
            Tooth {number}
          </p>
          {linkedTreatment && (
            <div className="flex items-center gap-1.5 text-xs text-pk-teal-700 bg-teal-50 rounded px-2 py-1.5 mb-2">
              <span className="font-medium truncate">{linkedTreatment.procedure || linkedTreatment.description}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1 mb-2">
            {ALL_CONDITIONS.map((c) => {
              const col = CONDITION_COLORS[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    if (c === condition) {
                      setPendingCondition(null);
                    } else {
                      setPendingCondition(c);
                    }
                  }}
                  className={`text-left text-xs px-2 py-1 rounded-pk-sm border transition-all ${displayCondition === c ? "ring-2 ring-offset-1 ring-[var(--pk-accent)]" : "hover:opacity-80"}`}
                  style={{ background: col.bg, borderColor: col.border, color: col.text }}
                >
                  {CONDITION_LABELS[c]}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Notes..."
            className="w-full text-xs border border-pk-border rounded-pk-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-pk-teal-400"
          />
          {/* Confirm / Undo — appears when a pending condition or notes change exists */}
          {hasChange && (
            <div className="mt-2 pt-2 border-t border-pk-border">
              {pendingCondition !== null && pendingCondition !== condition && (
                <p className="text-xs text-pk-text-muted mb-1.5 flex items-center gap-1.5">
                  Changing to:
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{ background: CONDITION_COLORS[pendingCondition].bg, color: CONDITION_COLORS[pendingCondition].text }}
                  >
                    {CONDITION_LABELS[pendingCondition]}
                  </span>
                </p>
              )}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onConditionChange(number, pendingCondition ?? condition, editNotes);
                    setPendingCondition(null);
                    setOpen(false);
                  }}
                  className="flex-1 bg-pk-teal-600 text-white text-xs py-1.5 rounded-pk-sm font-medium hover:bg-pk-teal-700 transition"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => { setPendingCondition(null); setEditNotes(originalNotes); }}
                  className="flex-1 border border-pk-border text-pk-text-secondary text-xs py-1.5 rounded-pk-sm font-medium hover:bg-pk-surface-raised transition"
                >
                  Undo
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
      {ALL_CONDITIONS.map((c) => {
        const col = CONDITION_COLORS[c];
        return (
          <div key={c} className="flex items-center gap-1">
            <span
              className="w-3.5 h-3.5 rounded-sm border flex-shrink-0"
              style={{ background: col.bg, borderColor: col.border }}
            />
            <span className="text-[10px] text-pk-text-muted">{CONDITION_LABELS[c]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ToothChart component ────────────────────────────────────────────────

interface ToothChartProps {
  data: ChartData;
  readOnly?: boolean;
  onChange?: (data: ChartData) => void;
  /** Tooth numbers to highlight with a ring — used to draw attention to specific teeth */
  highlightTeeth?: string[];
  /** Treatments linked to this visit — used to show treatment context in the tooth popover */
  linkedTreatments?: Array<{ id: string; description: string; procedure?: string | null; toothNumbers?: string | null }>;
  /** Called when a tooth condition changes, alongside onChange. Carries the associated treatmentId if any. */
  onToothChange?: (toothNumber: string, newCondition: ToothCondition, treatmentId: string | null) => void;
  /** Called when any tooth is clicked (before condition picker opens) — used to trigger per-tooth history */
  onToothSelect?: (toothNumber: string) => void;
}

export function ToothChart({ data, readOnly = false, onChange, highlightTeeth, linkedTreatments, onToothChange, onToothSelect }: ToothChartProps) {
  const highlightSet = new Set(highlightTeeth ?? []);

  // Build a map from tooth number → treatment (last IN_PROGRESS wins if multiple)
  const toothToTreatmentMap = new Map<string, { id: string; description: string; procedure?: string | null }>();
  if (linkedTreatments) {
    for (const tx of linkedTreatments) {
      if (!tx.toothNumbers) continue;
      for (const raw of tx.toothNumbers.split(",")) {
        const t = raw.trim();
        if (!t) continue;
        toothToTreatmentMap.set(t, { id: tx.id, description: tx.description, procedure: tx.procedure });
      }
    }
  }

  function handleChange(n: number, condition: ToothCondition, notes?: string) {
    const updated: ChartData = {
      ...data,
      [String(n)]: { condition, notes: notes || undefined },
    };
    // Remove HEALTHY entries to keep the stored object compact
    if (condition === "HEALTHY" && !notes) delete updated[String(n)];
    onChange?.(updated);
    const treatment = toothToTreatmentMap.get(String(n)) ?? null;
    onToothChange?.(String(n), condition, treatment?.id ?? null);
  }

  return (
    <div className="w-full">
      {/* Chart grid — scrolls horizontally on very small screens */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[700px]">
          {/* Legend row */}
          <div className="flex justify-between text-[9px] text-pk-text-muted font-medium mb-1 px-1">
            <span>Patient&apos;s Right (Q1/Q4)</span>
            <span>Patient&apos;s Left (Q2/Q3)</span>
          </div>

          {/* Upper arch */}
          <div className="flex items-end gap-0.5 justify-center mb-1 pb-2 border-b border-dashed border-pk-border">
            {UPPER_TEETH.map((n, i) => (
              <>
                {i === 8 && <div key="midline-upper" className="w-2 flex-shrink-0" />}
                <ToothCell
                  key={n}
                  number={n}
                  data={data[String(n)]}
                  isUpper={true}
                  readOnly={readOnly}
                  highlight={highlightSet.has(String(n))}
                  linkedTreatment={toothToTreatmentMap.get(String(n))}
                  onConditionChange={handleChange}
                  onToothSelect={onToothSelect}
                />
              </>
            ))}
          </div>

          {/* Midline label */}
          <div className="text-center text-[9px] text-pk-text-muted py-0.5 select-none">
            — occlusal plane —
          </div>

          {/* Lower arch */}
          <div className="flex items-start gap-0.5 justify-center mt-1 pt-2 border-t border-dashed border-pk-border">
            {LOWER_TEETH.map((n, i) => (
              <>
                {i === 8 && <div key="midline-lower" className="w-2 flex-shrink-0" />}
                <ToothCell
                  key={n}
                  number={n}
                  data={data[String(n)]}
                  isUpper={false}
                  readOnly={readOnly}
                  highlight={highlightSet.has(String(n))}
                  linkedTreatment={toothToTreatmentMap.get(String(n))}
                  onConditionChange={handleChange}
                  onToothSelect={onToothSelect}
                />
              </>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <Legend />
    </div>
  );
}
