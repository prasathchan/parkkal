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
  onConditionChange,
}: {
  number: number;
  data: ToothData | undefined;
  isUpper: boolean;
  readOnly: boolean;
  onConditionChange: (n: number, condition: ToothCondition, notes?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editNotes, setEditNotes] = useState(data?.notes ?? "");
  const ref = useRef<HTMLDivElement>(null);
  const condition: ToothCondition = data?.condition ?? "HEALTHY";
  const colors = CONDITION_COLORS[condition];
  const type = getToothType(number);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const height = type === "molar" ? "h-10" : type === "premolar" ? "h-9" : "h-8";

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
        onClick={() => { if (!readOnly) { setEditNotes(data?.notes ?? ""); setOpen(true); } }}
        className={`w-7 ${height} rounded-sm border-2 transition-all focus:outline-none relative ${readOnly ? "cursor-default" : "hover:scale-110 hover:z-10 cursor-pointer"}`}
        style={{ background: colors.bg, borderColor: colors.border }}
      >
        {/* Glyph overlays — colour-blind-safe cues (Brand §3.1). Light glyph on solid fills. */}
        {condition === "MISSING" && (
          <span className="absolute inset-0 flex items-center justify-center text-pk-neutral-700 text-xs font-bold">✕</span>
        )}
        {condition === "CROWN" && (
          <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold">◆</span>
        )}
        {condition === "ROOT_CANAL" && (
          <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold">▽</span>
        )}
        {condition === "BRIDGE" && (
          <span className="absolute inset-0 flex items-center justify-center text-white text-[8px] font-bold">BR</span>
        )}
        {condition === "IMPLANT" && (
          <span className="absolute inset-0 flex items-center justify-center text-white text-[8px] font-bold">IM</span>
        )}
      </button>

      {!isUpper && (
        <span className="text-[9px] text-pk-text-muted mt-0.5 leading-none select-none">{number}</span>
      )}

      {/* Condition popover */}
      {open && (
        <div
          className={`absolute z-50 w-52 bg-pk-surface rounded-xl shadow-2xl border border-pk-border p-2 ${isUpper ? "top-full mt-1" : "bottom-full mb-1"} ${number <= 18 || (number >= 31 && number <= 38) ? "left-0" : "right-0"}`}
        >
          <p className="text-xs font-semibold text-pk-text-secondary px-1 pb-1 border-b border-pk-border mb-1">
            Tooth {number}
          </p>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {ALL_CONDITIONS.map((c) => {
              const col = CONDITION_COLORS[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => { onConditionChange(number, c, editNotes); setOpen(false); }}
                  className={`text-left text-xs px-2 py-1 rounded-lg border transition-all ${condition === c ? "ring-2 ring-offset-1 ring-[var(--pk-accent)]" : "hover:opacity-80"}`}
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
            onBlur={() => onConditionChange(number, condition, editNotes)}
            placeholder="Notes..."
            className="w-full text-xs border border-pk-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-pk-teal-400"
          />
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
}

export function ToothChart({ data, readOnly = false, onChange }: ToothChartProps) {
  function handleChange(n: number, condition: ToothCondition, notes?: string) {
    const updated: ChartData = {
      ...data,
      [String(n)]: { condition, notes: notes || undefined },
    };
    // Remove HEALTHY entries to keep the stored object compact
    if (condition === "HEALTHY" && !notes) delete updated[String(n)];
    onChange?.(updated);
  }

  return (
    <div className="w-full">
      {/* Chart grid — scrolls horizontally on very small screens */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[520px]">
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
                  onConditionChange={handleChange}
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
                  onConditionChange={handleChange}
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
